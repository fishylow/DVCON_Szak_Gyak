
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
    "sap/ui/model/json/JSONModel" ,  
    "./../model/formatter" 
], function (Controller,
    History,
    Fragment,             
    MessageToast,
    MessageBox,
    JSONModel,
    formatter) {
    "use strict";
    const SUM_PATH = "summary";

    return Controller.extend("tripjournal.tripjournalui.controller.Detail", {
        formatter: formatter,
    
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
            this.getView().setModel(new JSONModel({ Gasmilage : 0, TotalCost : 0 }), SUM_PATH);
            this._loadAddressCache();
        },

        _loadAddressCache: function () {
          // shared cache model lives in core
          const oCache = sap.ui.getCore().getModel("addrCache") || new sap.ui.model.json.JSONModel({ map: {} });
          sap.ui.getCore().setModel(oCache, "addrCache");
        
          // grab main OData model from the component (view model may not be there yet)
          const oModel = this.getOwnerComponent().getModel();
          if (!oModel) { return; }
        
          oModel.metadataLoaded().then(function () {
            oModel.read("/ZbnhAddressSet", {
              success: function (oData) {
                const m = {};
                (oData.results || []).forEach(function (r) { m[r.Id] = r; });
                oCache.setProperty("/map", m);
              }
            });
          });
        },

        _onObjectMatched: function (oEvent) {
          const sUsername     = "BNEDER";
          const sYear         = oEvent.getParameter("arguments").year;
          const sMonth        = oEvent.getParameter("arguments").month;
          const sLicensePlate = oEvent.getParameter("arguments").licensePlate;
      
          const sKey = this.getView().getModel().createKey("TripHeaderSet", {
              Username : sUsername, Yyear : sYear, Mmonth : sMonth, LicensePlate : sLicensePlate
          });
          const sHdrPath = "/" + sKey;
      
          // bind header+items as before
          this.getView().bindElement({ path : sHdrPath, parameters : { $expand : "to_TripItemSet" } });
      
          // once metadata is ready, fetch header (with items) + car, then fill the helper model
          const oModel   = this.getView().getModel();
          const oSum     = this.getView().getModel(SUM_PATH);
      
          oModel.metadataLoaded().then(() => {
      
              // ③‑a  read header incl. all items so we can aggregate the cost
              oModel.read(sHdrPath, {
                  urlParameters : { "$expand" : "to_TripItemSet" },
                  success : oHdr => {
                    const aItems = (oHdr.to_TripItemSet && oHdr.to_TripItemSet.results) || [];
                    const tot    = aItems.reduce((s, it) => s + Number(it.Cost || 0), 0).toFixed(2);
                      oSum.setProperty("/TotalCost", tot);
                  }
              });
      
              // ③‑b  read the car once to get the consumption
              oModel.read("/ZbnhCarSet('" + sLicensePlate + "')", {
                  success : oCar => oSum.setProperty("/Gasmilage", oCar.Gasmilage)
              });
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

          /************  Address value‑help  ************/
          async onAddrValueHelpRequest(oEvt) {
            this._oAddrInput   = oEvt.getSource();                       // remember triggering field
            const oBind = this._oAddrInput.getBinding("value");
            this._addrPath  = oBind ? oBind.getPath() : "/FromAddr";
            this._addrModel = oBind ? oBind.getModel() : null; // FromAddr or ToAddr

            // Lazy‑load dialog once
            if (!this._oAddrVHD) {
              this._oAddrVHD = await sap.ui.core.Fragment.load({
                name      : "tripjournal.tripjournalui.view.AddressValueHelpDialog",
                controller: this
              });
              this.getView().addDependent(this._oAddrVHD);
              this._oAddrVHD.setSupportMultiselect(false);

              /* bind the internal table AFTER it is created */
              this._oAddrVHD.getTableAsync().then(function (oTable) {
                oTable.setModel(this.getView().getModel()); // OData v2 model

                if (oTable.bindRows) {
                  this._bindAddrRows(oTable);   // desktop
                } else {
                  this._bindAddrItems(oTable);  // phone / tablet
                }
              }.bind(this));
            }
            this._oAddrVHD.open();
          },

          /***** table column helpers *****/
          _bindAddrRows: function (oTable) {
            // sap.ui.table.Table
            oTable.addColumn(new sap.ui.table.Column({label:"ID",          template:new sap.m.Label({text:"{Id}"})}));
            oTable.addColumn(new sap.ui.table.Column({label:"Name",        template:new sap.m.Label({text:"{Name}"})}));
            oTable.addColumn(new sap.ui.table.Column({label:"City",        template:new sap.m.Label({text:"{City}"})}));
            oTable.addColumn(new sap.ui.table.Column({label:"Post Code",   template:new sap.m.Label({text:"{PostCode}"})}));
            oTable.bindRows({
              path  : "/ZbnhAddressSet",
              events: { dataReceived: () => this._oAddrVHD.update() }
            });
            // instant row‑click → commit
            oTable.attachRowSelectionChange(this._onAddrRowSelect, this);
          },

          _bindAddrItems: function (oTable) {
            // sap.m.Table
            oTable.addColumn(new sap.m.Column({header:"ID"}));
            oTable.addColumn(new sap.m.Column({header:"Name"}));
            oTable.addColumn(new sap.m.Column({header:"City"}));
            oTable.addColumn(new sap.m.Column({header:"Post Code"}));
            oTable.bindItems({
              path    : "/ZbnhAddressSet",
              template: new sap.m.ColumnListItem({cells:[
                new sap.m.Label({text:"{Id}"}),
                new sap.m.Label({text:"{Name}"}),
                new sap.m.Label({text:"{City}"}),
                new sap.m.Label({text:"{PostCode}"})
              ]}),
              events: { dataReceived: () => this._oAddrVHD.update() }
            });
            // tap‑row → commit
            oTable.attachSelectionChange(this._onAddrRowSelect, this);
          },

          /***** filtering *****/
          onAddrFilterBarSearch: function (oEvt) {
            const aCtrls  = oEvt.getParameter("selectionSet") || [],
                  aFilter = aCtrls.reduce((a,c)=>{
                    if (c.getValue()) a.push(new sap.ui.model.Filter(c.getName(), sap.ui.model.FilterOperator.Contains, c.getValue()));
                    return a;
                  }, []);
            this._filterAddrTable(aFilter.length ? new sap.ui.model.Filter({filters:aFilter,and:true}) : []);
          },
          _filterAddrTable: function (oFilter) {
            this._oAddrVHD.getTableAsync().then(function (oTable){
              const sAgg = oTable.bindRows ? "rows" : "items";
              oTable.getBinding(sAgg).filter(oFilter);
              this._oAddrVHD.update();
            }.bind(this));
          },

          /***** selection handlers *****/
          _onAddrRowSelect: function (oEvt) {
            let oCtx;
            const oSrc = oEvt.getSource();
            if (oSrc.getSelectedContexts) {           // m.Table
              oCtx = oSrc.getSelectedContexts()[0];
            } else {                                  // ui.table.Table
              const iSel = oSrc.getSelectedIndex();
              oCtx = iSel >= 0 ? oSrc.getContextByIndex(iSel) : null;
            }
            if (oCtx) { this._commitAddrSelection(oCtx.getObject()); }
          },

          // ENTER key or token select fallback
          onAddrVhOk: function (oEvt) {
            const aTokens = oEvt.getParameter("tokens") || [];
            if (aTokens.length) {
              this._commitAddrSelection({ Id: aTokens[0].getKey() });
            }
          },

          onAddrVhCancel: function(){ this._oAddrVHD.close(); },
          onAddrVhAfterClose: function(){ /* keep instance for speed */ },

          _commitAddrSelection: function (oAddr) {
            const sId = String(oAddr.Id);
            // 1) reflect in UI
            this._oAddrInput.setValue(sId);
            // 2) update bound model (edit model holds draft of item)
            if (this._addrModel) {
              this._addrModel.setProperty(this._addrPath, Number(sId));
            }
            this._oAddrVHD.close();
          }
    });
});