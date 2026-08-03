let currentContext = null;

export const zohoCRM = {
  initialize: () => {
    console.log("Zoho initialize started");
    
    // Detect if running inside Zoho (checking window.ZOHO)
    if (window.ZOHO && window.ZOHO.embeddedApp) {
      console.log("Zoho Embedded App SDK detected.");
      
      // Subscribe to events
      window.ZOHO.embeddedApp.on("PageLoad", function(data) {
        console.log("========== PAGE LOAD ==========");
        console.log(data);
        currentContext = data;
      });

      window.ZOHO.embeddedApp.on("Dial", function(data) {
        console.log("========== DIAL ==========");
        console.log(data);
      });

      window.ZOHO.embeddedApp.on("HistoryPopState", function(data) {
        console.log("========== HISTORY POP STATE ==========");
        console.log(data);
      });

      // Initialize the app
      window.ZOHO.embeddedApp.init().then(async () => {
        console.log("Zoho Embedded App SDK Initialization Complete!");

        console.log("Fetching Zoho Context APIs...");

        try {
          const userConfig = await window.ZOHO.CRM.CONFIG.getCurrentUser();
          console.log("========== ZOHO.CRM.CONFIG.getCurrentUser() ==========");
          console.log(userConfig);
        } catch (err) {
          console.error("ZOHO.CRM.CONFIG.getCurrentUser error:", err);
        }

        try {
          const orgConfig = await window.ZOHO.CRM.CONFIG.getCurrentOrg();
          console.log("========== ZOHO.CRM.CONFIG.getCurrentOrg() ==========");
          console.log(orgConfig);
        } catch (err) {
          console.error("ZOHO.CRM.CONFIG.getCurrentOrg error:", err);
        }

        try {
          // Some API versions might only have CONFIG, wrapping this in try/catch to be safe
          if (window.ZOHO.CRM.UI && window.ZOHO.CRM.UI.getCurrentUser) {
            const uiUser = await window.ZOHO.CRM.UI.getCurrentUser();
            console.log("========== ZOHO.CRM.UI.getCurrentUser() ==========");
            console.log(uiUser);
          }
        } catch (err) {
          console.error("ZOHO.CRM.UI.getCurrentUser error:", err);
        }

        try {
          if (window.ZOHO.CRM.INTERACTION && window.ZOHO.CRM.INTERACTION.getPageInfo) {
            const pageInfo = await window.ZOHO.CRM.INTERACTION.getPageInfo();
            console.log("========== ZOHO.CRM.INTERACTION.getPageInfo() ==========");
            console.log(pageInfo);
          }
        } catch (err) {
          console.error("ZOHO.CRM.INTERACTION.getPageInfo error:", err);
        }

      });
      
    } else {
      console.warn("ZOHO SDK not found on window object. App is not running inside Zoho, or SDK script failed to load.");
    }
  },
  getCurrentRecordContext: () => {
    if (!currentContext || !currentContext.Entity) return null;
    return {
      module: currentContext.Entity,
      recordId: currentContext.EntityId ? currentContext.EntityId[0] : null
    };
  },
  getCurrentContactPhone: async () => {
    const context = zohoCRM.getCurrentRecordContext();
    if (!context || context.module !== "Contacts" || !context.recordId) return null;

    try {
      const response = await window.ZOHO.CRM.API.getRecord({
        Entity: "Contacts",
        RecordID: context.recordId
      });

      if (response && response.data && response.data.length > 0) {
        const record = response.data[0];
        const phone = record.Phone || record.Mobile;
        const contactName = `${record.First_Name || ''} ${record.Last_Name || ''}`.trim();
        
        if (phone) {
          return { phone, contactName };
        }
      }
    } catch (err) {
      console.error("Failed to fetch contact details for click-to-call", err);
    }
    return null;
  },
  showDialer: () => {
    console.log("Zoho showDialer");
  },
  openContact: (contact_id) => {
    console.log("Zoho openContact", contact_id);
  },
  openIncident: (incident_id) => {
    console.log("Zoho openIncident", incident_id);
  }
};
