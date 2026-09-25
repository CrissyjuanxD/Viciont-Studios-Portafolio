// Cliente mínimo de la API de GitHub para el panel de administración.
// El token solo vive en memoria (y en el almacenamiento del navegador si eliges "recordar").
// Nunca se envía a otro sitio que no sea api.github.com.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message || `GitHub respondió con el código ${status}`);
    this.status = status;
  }
}

function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

export class GitHubClient {
  #token;

  constructor({ token, owner, repo, branch }) {
    this.#token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  get base() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  async request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.#token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError(0, 'No se pudo conectar con GitHub. Revisa tu conexión a internet.');
    }
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).message || ''; } catch { /* sin cuerpo */ }
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        msg = 'Has superado el límite de peticiones de GitHub. Espera unos minutos.';
      }
      throw new GitHubError(res.status, msg);
    }
    return res.status === 204 ? null : res.json();
  }

  user() { return this.request('/user'); }

  repoInfo() { return this.request(this.base); }

  // Lee un archivo de texto del repositorio y devuelve { sha, text }.
  async getText(path, ref = this.branch) {
    const data = await this.request(`${this.base}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`);
    if (data.content && data.encoding === 'base64') return { sha: data.sha, text: b64ToUtf8(data.content) };
    const blob = await this.request(`${this.base}/git/blobs/${data.sha}`);
    return { sha: data.sha, text: b64ToUtf8(blob.content) };
  }

  // Crea UN commit con varios archivos a la vez (imágenes + content.json).
  // files: [{ path, content, encoding: 'utf-8' | 'base64' }]
  // expect: { path, sha } -> aborta si ese archivo cambió en GitHub mientras editabas.
  async commitFiles({ files, message, expect, onProgress }) {
    const ref = await this.request(`${this.base}/git/ref/heads/${encodeURIComponent(this.branch)}`);
    const headSha = ref.object.sha;

    if (expect) {
      const cur = await this.request(`${this.base}/contents/${encPath(expect.path)}?ref=${headSha}`);
      if (cur.sha !== expect.sha) {
        const err = new GitHubError(409, 'El contenido cambió en GitHub desde que abriste el panel.');
        err.conflict = true;
        throw err;
      }
    }

    const headCommit = await this.request(`${this.base}/git/commits/${headSha}`);
    const tree = [];
    const shas = {};
    let done = 0;
    for (const f of files) {
      const blob = await this.request(`${this.base}/git/blobs`, {
        method: 'POST',
        body: { content: f.content, encoding: f.encoding || 'utf-8' },
      });
      shas[f.path] = blob.sha;
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      onProgress?.(++done, files.length);
    }

    const newTree = await this.request(`${this.base}/git/trees`, {
      method: 'POST',
      body: { base_tree: headCommit.tree.sha, tree },
    });
    const commit = await this.request(`${this.base}/git/commits`, {
      method: 'POST',
      body: { message, tree: newTree.sha, parents: [headSha] },
    });
    await this.request(`${this.base}/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });
    return { commit, shas };
  }

  history(path, perPage = 20) {
    return this.request(`${this.base}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(this.branch)}&per_page=${perPage}`);
  }
}

export function explainError(err) {
  const s = err?.status;
  if (err?.conflict) return err.message;
  if (s === 0) return err.message;
  if (s === 401) return 'El token no es válido o ha caducado. Crea uno nuevo en GitHub.';
  if (s === 403) return err.message && !/^Resource not accessible/i.test(err.message)
    ? err.message
    : 'El token no tiene permiso de escritura. Debe tener "Contents: Read and write" en este repositorio.';
  if (s === 404) return 'No se encontró el repositorio o el token no tiene acceso a él.';
  if (s === 409) return 'GitHub rechazó el cambio porque el repositorio cambió. Recarga el panel e inténtalo de nuevo.';
  if (s === 422) return `GitHub rechazó el cambio: ${err.message}`;
  return err?.message || 'Ocurrió un error inesperado.';
}
