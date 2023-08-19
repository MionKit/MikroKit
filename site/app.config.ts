export default defineAppConfig({
  docus: {
    title: 'Mion',
    description: 'Typescript Apis at the speed of light 🚀',
    image: 'https://raw.githubusercontent.com/MionKit/mion/9c0fcf2cd03aa373833ca071a6befc5643a718df/assets/public/logo-dark.svg',
    socials: {
      github: 'MionKit/mion',
      twitter: '@Ma_jrz',
    },
    github: {
      dir: 'docs/content',
      branch: 'main',
      repo: 'mion',
      owner: 'MionKit',
      edit: true
    },
    aside: {
      level: 0,
      collapsed: false,
      exclude: []
    },
    main: {
      padded: true,
      fluid: true
    },
    header: {
      padded: true,
      logo: true,
      showLinkIcon: true,
      exclude: [],
      fluid: false
    }
  }
})
