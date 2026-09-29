if (location.hostname === 'crissyjuanxd.github.io') {
  const rest = location.pathname.replace(/^\/Viciont-Studios-Portafolio\/?/i, '');
  location.replace(`https://viciontstudios.pages.dev/${rest}${location.search}${location.hash}`);
}
