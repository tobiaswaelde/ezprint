export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc',
    },
    dashboardToolbar: {
      slots: {
        root: 'min-h-0',
      },
    },
  },
  querryKit: {
    table: {
      icons: {
        options: {
          unpin: 'i-tabler-pinned-off',
        },
      },
    },
  },
});
