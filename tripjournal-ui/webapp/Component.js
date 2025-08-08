sap.ui.define([
    "sap/ui/core/UIComponent",
    "tripjournal/tripjournalui/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("tripjournal.tripjournalui.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        /**
         * Initializes the UI component.
         * Sets device model and starts the router.
         */
        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();    
        }
    });
});