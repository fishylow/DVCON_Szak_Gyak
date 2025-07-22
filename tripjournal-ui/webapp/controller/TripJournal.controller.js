sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./../model/formatter"
], function (Controller, Filter, FilterOperator, formatter) {
    "use strict";

    return Controller.extend("tripjournal.tripjournalui.controller.TripJournal", {
        formatter: formatter,

        onInit: function () {
            // Future initialization logic will go here
        },

        /**Navigation on click to the Details page. */
        onNavToDetails: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            // It's safer to get properties from the model object
            const oObject = oContext.getObject();
        
            this.getOwnerComponent().getRouter().navTo("RouteDetail", {
                username: oObject.Username,
                year: oObject.Yyear,
                month: oObject.Mmonth,
                licensePlate: oObject.LicensePlate
            });
        },

        /**
         * Filters the trip header table based on user input.
         */
        onFilterTrips: function () {
            const oView = this.getView();
            const sStatus = oView.byId("statusFilter").getSelectedKey();
            const oDateRange = oView.byId("dateFilter");
            const dFromDate = oDateRange.getDateValue();
            const dToDate = oDateRange.getSecondDateValue();
            const sLicensePlate = oView.byId("licensePlateFilter").getValue();
            const oTable = oView.byId("tripHeaderTable");
            const oBinding = oTable.getBinding("items");

            const aFilters = [];

            if (sStatus) {
                aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus));
            }

            if (sLicensePlate) {
                aFilters.push(new Filter("LicensePlate", FilterOperator.Contains, sLicensePlate));
            }

            // Note: Filtering by a combined Year/Month from a DateRangeSelection
            // can be complex and depends on backend capabilities.
            // This is a simplified example. A robust solution might require backend changes
            // or more complex client-side logic.
            if (dFromDate && dToDate) {
                 // For simplicity, we'll filter by Year for now.
                 // A proper implementation would need to handle year and month ranges.
                aFilters.push(new Filter("Yyear", FilterOperator.EQ, dFromDate.getFullYear()));
            }

            oBinding.filter(aFilters);
        },

        /**
         * Clears all filters and refreshes the table binding.
         */
        onClearFilter: function () {
            const oView = this.getView();
            oView.byId("statusFilter").setSelectedKey("");
            oView.byId("dateFilter").setValue("");
            oView.byId("licensePlateFilter").setValue("");

            const oTable = oView.byId("tripHeaderTable");
            const oBinding = oTable.getBinding("items");
            oBinding.filter([]);
        },

        /**
         * Placeholder for opening the 'Create New Trip' dialog.
         */
        onOpenCreateDialog: function () {
            // We will implement the dialog and creation logic in the next step.
            sap.m.MessageToast.show("Create new trip dialog will be opened here.");
        }
    });
});