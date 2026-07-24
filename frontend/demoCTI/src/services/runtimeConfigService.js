class RuntimeConfigService {
    constructor() {
        this.config = {
            connector: "servicenow",
            features: {
                screen_pop: false,
                click_to_call: false
            }
        };
    }

    async initialize() {
        await this.fetchConfig();
        this.logConfig();
    }

    async refresh() {
        await this.fetchConfig();
        this.logConfig(true);
        return this.config;
    }

    async fetchConfig() {
        try {
            const response = await fetch('http://localhost:8000/api/runtime-config?connector=servicenow');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config = await response.json();
        } catch (error) {
            console.error('[RuntimeConfig] Failed to fetch configuration from Portal:', error);
            // Fallback to default config on error
            this.config = {
                connector: "servicenow",
                features: {
                    screen_pop: false,
                    click_to_call: false
                }
            };
        }
    }

    getConfig() {
        return this.config;
    }

    isFeatureEnabled(featureName) {
        return !!this.config.features?.[featureName];
    }

    logConfig(isUpdate = false) {
        if (isUpdate) {
            console.log('--------------------------------------');
            console.log('Runtime Configuration Updated');
            console.log(`Connector:${this.config.connector}`);
            console.log(`Screen Pop:${this.isFeatureEnabled('screen_pop') ? 'Enabled' : 'Disabled'}`);
            console.log(`Click To Call:${this.isFeatureEnabled('click_to_call') ? 'Enabled' : 'Disabled'}`);
            console.log('--------------------------------------');
        } else {
            console.log('[RuntimeConfig]');
            console.log(`Connector: ${this.config.connector}`);
            console.log('Features:');
            console.log(`Screen Pop: ${this.isFeatureEnabled('screen_pop') ? 'Enabled' : 'Disabled'}`);
            console.log(`Click To Call: ${this.isFeatureEnabled('click_to_call') ? 'Enabled' : 'Disabled'}`);
        }
    }
}

const runtimeConfigService = new RuntimeConfigService();
export default runtimeConfigService;
