
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History"
], function (Controller, History) {
    "use strict";

    return Controller.extend("tripjournal.tripjournalui.controller.Detail", {
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const sUsername = oEvent.getParameter("arguments").username;
            const sYear = oEvent.getParameter("arguments").year;
            const sMonth = oEvent.getParameter("arguments").month;
            const sLicensePlate = oEvent.getParameter("arguments").licensePlate;

            // Construct the binding path from the key parameters
            const sObjectPath = this.getView().getModel().createKey("TripHeaderSet", {
                Username: sUsername,
                Yyear: sYear,
                Mmonth: sMonth,
                LicensePlate: sLicensePlate
            });

            this.getView().bindElement({
                path: "/" + sObjectPath,
                parameters: {
                    expand: "to_TripItemSet"
                }
            });
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteTripJournal", {}, true);
            }
        },

        onOpenCreateItemDialog: function() {
            // We will implement this in a future step
            sap.m.MessageToast.show("Create new item dialog will be opened here.");
        }
    });
});