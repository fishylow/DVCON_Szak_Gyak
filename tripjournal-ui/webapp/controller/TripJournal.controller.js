sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./../model/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
    
], function (Controller, Filter, FilterOperator, formatter, Fragment, JSONModel, MessageToast, MessageBox) {
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

        onOpenCreateDialog: function () {
            // Lazy‑load the fragment
            if (!this._oCreateDialog) {
              Fragment.load({
                name: "tripjournal.tripjournalui.view.CreateTrip",
                controller: this
              }).then(function (oDialog) {
                this.getView().addDependent(oDialog);
      
                // init JSONModel for the input fields
                const oData = {
                  Yyear: new Date().getFullYear(),
                  Mmonth: ("0" + (new Date().getMonth() + 1)).slice(-2),
                  LicensePlate: "",
                  KmBefore: 0,
                  GasPrice: 0,
                  GasCurr: "EUR"
                };
                const oJSON = new JSONModel(oData);
                oDialog.setModel(oJSON, "create");
      
                this._oCreateDialog = oDialog;
                oDialog.open();
              }.bind(this));
            } else {
              this._oCreateDialog.open();
            }
          },
      
          onCloseCreateDialog: function () {
            this._oCreateDialog.close();
          },
      
          onCreateTrip: function () {
            // 1. read data from the dialog‑scoped model
            const oCreate = this._oCreateDialog.getModel("create").getData();
        
            const sGasPrice = Number(oCreate.GasPrice || 0).toFixed(3);
            // 2. compose payload
            const oPayload = {
                Username:     "BNEDER",          // ideiglenesen sajat userbe tolom bele mert amugy nem mukodik
                Yyear:        Number(oCreate.Yyear),
                Mmonth:       oCreate.Mmonth,
                LicensePlate: oCreate.LicensePlate,
                KmBefore:     Number(oCreate.KmBefore),
                KmAfter:      Number(oCreate.KmAfter),
                GasPrice:     sGasPrice,
                GasCurr:      oCreate.GasCurr,
                Status:       "N",
                Note:         ""
            };
        
            // 3. create header
            this.getView().getModel().create("/TripHeaderSet", oPayload, {
                success: function () {
                    sap.m.MessageToast.show("New trip created");
                    this._oCreateDialog.close();
                    // refresh header list
                    this.byId("tripHeaderTable")
                        .getBinding("items")
                        .refresh();
                }.bind(this),
                error: function (oErr) {
                    sap.m.MessageBox.error(
                        sap.ui.core.format.MessageFormat.format(
                            "Creation failed: {0}", [oErr.message || oErr.responseText]
                        )
                    );
                }
            });
        }
        });
      });