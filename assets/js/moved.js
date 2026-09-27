// La web se mudó a Cloudflare Pages (https://viciontstudios.pages.dev/).
// Quien entre por la dirección antigua de GitHub Pages pasa a la misma página en la nueva.
// data/content.json se sigue sirviendo en las dos direcciones para los launchers antiguos.
if (location.hostname === 'crissyjuanxd.github.io') {
  const rest = location.pathname.replace(/^\/Viciont-Studios-Portafolio\/?/i, '');
  location.replace(`https://viciontstudios.pages.dev/${rest}${location.search}${location.hash}`);
}
