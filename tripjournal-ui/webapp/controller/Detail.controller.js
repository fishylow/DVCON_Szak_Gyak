
/** returns a zero‑padded 10‑digit string */
function getBatchId() {
    const timePortion = (Date.now() % 1e8).toString().padStart(8, "0"); // 8 digits
    const rndPortion  = Math.floor(Math.random() * 90 + 10).toString(); // 2 digits
    return timePortion + rndPortion;                                     // 10 digits
  }

/** calculates trip cost (to 3 decimals) */
function calcCost(distanceKm, lPer100Km, fuelPrice) {
  const qty = Number(distanceKm) / 100 * Number(lPer100Km) ;            // litres consumed
  return +(qty * Number(fuelPrice)).toFixed(3);                        // money (scale 3)
}

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/Fragment",          
    "sap/m/MessageToast",            
    "sap/m/MessageBox", 
    "sap/m/ObjectAttribute",             
    "sap/ui/model/json/JSONModel" ,  
    "./../model/formatter" 
], function (Controller,
    History,
    Fragment,             
    MessageToast,
    MessageBox,
    ObjectAttribute,
    JSONModel,
    formatter) {
    "use strict";

    return Controller.extend("tripjournal.tripjournalui.controller.Detail", {
        formatter: formatter,
    
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
        },

      _onObjectMatched: function (oEvent) {
        const sUsername     = "BNEDER";
        const sYear         = oEvent.getParameter("arguments").year;
        const sMonth        = oEvent.getParameter("arguments").month;
        const sLicensePlate = oEvent.getParameter("arguments").licensePlate;

        const sObjectPath = this.getView().getModel().createKey("TripHeaderSet", {
            Username     : sUsername,
            Yyear        : sYear,
            Mmonth       : sMonth,
            LicensePlate : sLicensePlate
        });

        this.getView().bindElement({
            path       : "/" + sObjectPath,
            parameters : { $expand : "to_TripItemSet" },
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

        onItemSelectionChange: function (oEvt) {
            const aSel = oEvt.getSource().getSelectedItems();
            this.byId("editItemBtn").setEnabled(aSel.length === 1);
            this.byId("delItemBtn").setEnabled(aSel.length > 0);
        },

        onOpenCreateItemDialog: function () {
            if (!this._oCreateItemDlg) {
              Fragment.load({
                name: "tripjournal.tripjournalui.view.CreateItem",
                controller: this
              }).then(function (oDlg) {
                this.getView().addDependent(oDlg);
          
                // header fields reused, other fields blank
                const oHdr = this.getView().getBindingContext().getObject();
                const oData = {
                  Username     : "BNEDER",
                  Yyear        : oHdr.Yyear,
                  Mmonth       : oHdr.Mmonth,
                  LicensePlate : oHdr.LicensePlate,
                  FromAddr     : null,
                  ToAddr       : null,
                  Ddate        : new Date(),
                  Distance     : null,
                  Note         : ""
                };
                oDlg.setModel(new JSONModel(oData), "createItem");
                this._oCreateItemDlg = oDlg;
                oDlg.open();
              }.bind(this));
            } else {
              this._oCreateItemDlg.open();
            }
          },

          onCreateItem: function () {
            const oRaw = this._oCreateItemDlg.getModel("createItem").getData();
            if (oRaw.FromAddr === oRaw.ToAddr) {
                return MessageBox.error("From and To cannot be identical.");
            }

            /* header values (fuel price / currency) */
            const oHdr   = this.getView().getBindingContext().getObject();
            const oModel = this.getView().getModel();

            /* fetch mileage for the selected car */
            const sCarPath = "/" + oModel.createKey("ZbnhCarSet", {
                LicensePlate: oHdr.LicensePlate
            });

            oModel.read(sCarPath, {
                success : oCar => {
                    const fGasmilage = Number(oCar.Gasmilage) || 0;
                    const fCost      = calcCost(oRaw.Distance, fGasmilage, oHdr.GasPrice);

                    const oPayload = {
                        Username     : "BNEDER",
                        Yyear        : Number(oRaw.Yyear),
                        Mmonth       : oRaw.Mmonth,
                        LicensePlate : oRaw.LicensePlate,
                        Batchid      : getBatchId(),
                        FromAddr     : Number(oRaw.FromAddr),
                        ToAddr       : Number(oRaw.ToAddr),
                        Ddate        : oRaw.Ddate.toISOString().split("T")[0] + "T00:00:00",
                        Distance     : Number(oRaw.Distance),
                        Cost         : String(fCost),
                        Currency     : oHdr.GasCurr,
                        Note         : oRaw.Note
                    };

                    oModel.create("/TripItemSet", oPayload, {
                        success : () => {
                            MessageToast.show("Item created");
                            this._oCreateItemDlg.close();
                            this.byId("tripItemTable").getBinding("items").refresh();
                        },
                        error   : oErr => MessageBox.error(oErr.message)
                    });
                },
                error   : oErr => MessageBox.error(oErr.message)
            });
        },

        onOpenEditItemDialog: async function () {
            if (!this._oEditItemDlg) {
              this._oEditItemDlg = await Fragment.load({
                name: "tripjournal.tripjournalui.view.EditItem",
                controller: this
              });
              this.getView().addDependent(this._oEditItemDlg);
            }
          
            const oCtx  = this.byId("tripItemTable").getSelectedItem().getBindingContext();
            const oJSON = new JSONModel(Object.assign({}, oCtx.getObject()));
            this._oEditItemDlg.setModel(oJSON, "editItem");
            this._oEditItemDlg.open();
        },

        onUpdateItem: function () {
          const oRaw  = this._oEditItemDlg.getModel("editItem").getData();
          const sPath = this.byId("tripItemTable")
                           .getSelectedItem().getBindingContext().getPath();

          /* header values (fuel price / currency) */
          const oHdr   = this.getView().getBindingContext().getObject();
          const oModel = this.getView().getModel();
          const sCarPath = "/" + oModel.createKey("ZbnhCarSet", {
              LicensePlate: oHdr.LicensePlate
          });

          oModel.read(sCarPath, {
              success : oCar => {
                  const fGasmilage = Number(oCar.Gasmilage) || 0;
                  const fCost      = calcCost(oRaw.Distance, fGasmilage, oHdr.GasPrice);

                  const oPayload = Object.assign({}, oRaw, {
                      FromAddr : Number(oRaw.FromAddr),
                      ToAddr   : Number(oRaw.ToAddr),
                      Distance : Number(oRaw.Distance),
                      Cost     : String(fCost),
                      Currency : oHdr.GasCurr
                  });

                  oModel.update(sPath, oPayload, {
                      merge   : true,
                      success : () => {
                          MessageToast.show("Item updated");
                          this._oEditItemDlg.close();
                      },
                      error   : oErr => MessageBox.error(oErr.message)
                  });
              },
              error   : oErr => MessageBox.error(oErr.message)
          });
      },

          onCancelItemDialog: function (oEvt) {
            oEvt.getSource().getParent().close();
          },
          
          // --- overcomplicated delete function, but it works
          onDeleteSelectedItems: function () {
            const aItems = this.byId("tripItemTable").getSelectedItems();
            if (aItems.length === 0) { return; }
          
            MessageBox.confirm(`Delete ${aItems.length} item(s)?`, {
              onClose: sBtn => {
                if (sBtn !== MessageBox.Action.OK) { return; }
          
                const oModel   = this.getView().getModel();
          
                /* make one batch group */
                const sGroup   = "massDel_" + Date.now();
                oModel.setDeferredBatchGroups([sGroup]);            
          
                /* schedule each DELETE with its own change‑set */
                aItems.forEach((oIt, idx) => {
                  oModel.remove(
                    oIt.getBindingContext().getPath(),
                    {
                      groupId     : sGroup,                         
                      changeSetId : "cs" + idx                      
                    }
                  );
                });
          
                /* send the batch in one go */
                oModel.submitChanges({
                  groupId : sGroup,                                
                  success : () => {
                    MessageToast.show("Deletion finished");        
                    this.byId("tripItemTable").removeSelections();
                    this.byId("delItemBtn").setEnabled(false);
                  },
                  error   : oErr => MessageBox.error(oErr.message)
                });
              }
            });
          },
    });
});