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
          
        },

        /**Navigation on click to the Details page. */
        onNavToDetails: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
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

        onSelectionChange: function (oEvt) {
            const aSel = oEvt.getSource().getSelectedItems();
            this.byId("editHeaderBtn").setEnabled(aSel.length === 1);   
        },

        onOpenEditHeaderDialog: async function () {
            if (!this._oEditDialog) {
              const oDlg = await Fragment.load({
                name: "tripjournal.tripjournalui.view.EditHeader",       
                controller: this
              });                                                       
              this.getView().addDependent(oDlg);
              this._oEditDialog = oDlg;
            }
          
            // pre‑fill JSON model with the ONLY editable fields
            const oCtx   = this.byId("tripHeaderTable").getSelectedItem().getBindingContext();
            const oData  = Object.assign({}, oCtx.getObject());
            const oJSON  = new JSONModel(oData);
            this._oEditDialog.setModel(oJSON, "edit");
            this._oEditDialog.open();
        },

        onUpdateHeader: function () {
            const oData = this._oEditDialog.getModel("edit").getData();
            oData.setAutoExpandSelect(true);
            const sPath = this.byId("tripHeaderTable")
                             .getSelectedItem().getBindingContext().getPath();
          
            this.getView().getModel().update(
              sPath,
              {
                KmBefore : Number(oData.KmBefore),
                GasPrice : Number(oData.GasPrice).toFixed(3),
                GasCurr  : oData.GasCurr
              },
              {
                success : () => {
                  MessageToast.show("Header updated");                   // update via OData
                  this._oEditDialog.close();
                },
                error   : oErr => MessageBox.error(oErr.message)
              });
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

          onCancelHeaderDialog: function (oEvt) {
            oEvt.getSource().getParent().close();
          },
        
          onCreateTrip: function () {
            // 1. read data from the dialog‑scoped model
            const oCreate = this._oCreateDialog.getModel("create").getData();
        
            const sGasPrice = Number(oCreate.GasPrice || 0).toFixed(3);
            // 2. compose payload
            const oPayload = {
                Username:     "BNEDER",          // ideiglenesen sajat userbe rakom
                Yyear:        Number(oCreate.Yyear),
                Mmonth:       oCreate.Mmonth,
                LicensePlate: oCreate.LicensePlate,
                KmBefore:     Number(oCreate.KmBefore),
                KmAfter:      Number(oCreate.KmBefore),
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