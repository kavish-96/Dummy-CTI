export const servicenowCRM = {
  initialize: () => {},
  showDialer: () => {
    if (window.openFrameAPI) {
      window.openFrameAPI.show();
    }
  },
  openContact: (contact_sys_id) => {
    if (window.openFrameAPI) {
      window.openFrameAPI.openServiceNowForm({
        entity: "customer_contact",
        query: `sys_id=${contact_sys_id}`
      });
    }
  },
  openIncident: (incident_sys_id) => {
    if (window.openFrameAPI) {
      window.openFrameAPI.openServiceNowForm({
        entity: "incident",
        query: `sys_id=${incident_sys_id}`
      });
    }
  }
};
