
/**
 * Utility function to generate a unique batch ID
 * @returns {string} A zero-padded 10-digit string combining timestamp and random number
 */
function getBatchId() {
  const timePortion = (Date.now() % 1e8).toString().padStart(8, "0"); // 8 digits from timestamp
  const rndPortion  = Math.floor(Math.random() * 90 + 10).toString(); // 2 random digits (10-99)
  return timePortion + rndPortion;                                     // 10 digits total
}

/**
* Calculates trip cost based on distance, fuel consumption, and fuel price
* @param {number} distanceKm - Distance in kilometers
* @param {number} lPer100Km - Fuel consumption in liters per 100km
* @param {number} fuelPrice - Fuel price per liter
* @returns {number} Calculated cost rounded to 3 decimal places
*/
function calcCost(distanceKm, lPer100Km, fuelPrice) {
  const qty = Number(distanceKm) / 100 * Number(lPer100Km);            // liters consumed
  return +(qty * Number(fuelPrice)).toFixed(3);                        // money (scale 3)
}

sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/core/Fragment",          
  "sap/m/MessageToast",            
  "sap/m/MessageBox",          
  "sap/ui/model/json/JSONModel",  
  "./../model/formatter" 
], function (Controller,
  History,
  Fragment,             
  MessageToast,
  MessageBox,
  JSONModel,
  formatter) {
  "use strict";

  // Constants
  const SUM_PATH = "summary";

  return Controller.extend("tripjournal.tripjournalui.controller.Detail", {
      formatter: formatter,
  
      /**
       * Initializes the Detail controller
       * Sets up routing, summary model, and loads address cache
       */
      onInit: function () {
          const oRouter = this.getOwnerComponent().getRouter();
          oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
          
          // Initialize summary model for gas mileage and total cost
          this.getView().setModel(new JSONModel({ Gasmilage: 0, TotalCost: 0 }), SUM_PATH);
          
          this._loadAddressCache();
      },

      /**
       * Loads address data into a shared cache model for performance
       * This cache is shared across the entire application
       */
      _loadAddressCache: function () {
          // Get or create shared cache model that lives in core
          const oCache = sap.ui.getCore().getModel("addrCache") || new sap.ui.model.json.JSONModel({ map: {} });
          sap.ui.getCore().setModel(oCache, "addrCache");
      
          // Get main OData model from the component
          const oModel = this.getOwnerComponent().getModel();
          if (!oModel) { 
              return; 
          }
      
          // Load address data once metadata is ready
          oModel.metadataLoaded().then(function () {
              oModel.read("/ZbnhAddressSet", {
                  success: function (oData) {
                      const m = {};
                      (oData.results || []).forEach(function (r) { 
                          m[r.Id] = r; 
                      });
                      oCache.setProperty("/map", m);
                  }
              });
          });
      },

      /**
       * Handles route pattern matching when navigating to detail page
       * Binds trip header and items, then calculates summary data
       * @param {sap.ui.base.Event} oEvent - Route matching event
       */
      _onObjectMatched: function (oEvent) {
          const sUsername     = "BNEDER";
          const sYear         = oEvent.getParameter("arguments").year;
          const sMonth        = oEvent.getParameter("arguments").month;
          const sLicensePlate = oEvent.getParameter("arguments").licensePlate;
    
          // Create key for trip header binding
          const sKey = this.getView().getModel().createKey("TripHeaderSet", {
              Username: sUsername, 
              Yyear: sYear, 
              Mmonth: sMonth, 
              LicensePlate: sLicensePlate
          });
          const sHdrPath = "/" + sKey;
    
          // Bind header with expanded items
          this.getView().bindElement({ 
              path: sHdrPath, 
              parameters: { $expand: "to_TripItemSet" } 
          });
    
          // Fetch header data and car information to populate summary model
          const oModel = this.getView().getModel();
          const oSum   = this.getView().getModel(SUM_PATH);
    
          oModel.metadataLoaded().then(() => {
              // Read header with items to calculate total cost
              oModel.read(sHdrPath, {
                  urlParameters: { "$expand": "to_TripItemSet" },
                  success: oHdr => {
                      const aItems = (oHdr.to_TripItemSet && oHdr.to_TripItemSet.results) || [];
                      const tot   = aItems.reduce((s, it) => s + Number(it.Cost || 0), 0).toFixed(2);
                      oSum.setProperty("/TotalCost", tot);
                  }
              });
    
              // Read car data to get fuel consumption
              oModel.read("/ZbnhCarSet('" + sLicensePlate + "')", {
                  success: oCar => oSum.setProperty("/Gasmilage", oCar.Gasmilage)
              });
          });
      },

      /**
       * Handles navigation back to previous page
       * Uses browser history if available, otherwise navigates to trip journal
       */
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

      /**
       * Handles item selection change in the trip items table
       * Enables/disables edit and delete buttons based on selection
       * @param {sap.ui.base.Event} oEvt - Selection change event
       */
      onItemSelectionChange: function (oEvt) {
          const aSel = oEvt.getSource().getSelectedItems();
          this.byId("editItemBtn").setEnabled(aSel.length === 1);
          this.byId("delItemBtn").setEnabled(aSel.length > 0);
      },

      /**
       * Opens the create item dialog
       * Lazy-loads the dialog fragment and pre-fills with header data
       */
      onOpenCreateItemDialog: function () {
          if (!this._oCreateItemDlg) {
              Fragment.load({
                  name: "tripjournal.tripjournalui.view.CreateItem",
                  controller: this
              }).then(function (oDlg) {
                  this.getView().addDependent(oDlg);
        
                  // Pre-fill with header fields, other fields remain blank
                  const oHdr = this.getView().getBindingContext().getObject();
                  const oData = {
                      Username:     "BNEDER",
                      Yyear:        oHdr.Yyear,
                      Mmonth:       oHdr.Mmonth,
                      LicensePlate: oHdr.LicensePlate,
                      FromAddr:     null,
                      ToAddr:       null,
                      Ddate:        new Date(),
                      Distance:     null,
                      Note:         ""
                  };
                  oDlg.setModel(new JSONModel(oData), "createItem");
                  this._oCreateItemDlg = oDlg;
                  oDlg.open();
              }.bind(this));
          } else {
              this._oCreateItemDlg.open();
          }
      },

      /**
       * Creates a new trip item
       * Validates input, calculates cost, and saves to backend
       */
      onCreateItem: function () {
          const oRaw = this._oCreateItemDlg.getModel("createItem").getData();
          
          // Validate that from and to addresses are different
          if (oRaw.FromAddr === oRaw.ToAddr) {
              return MessageBox.error("From and To cannot be identical.");
          }

          // Get header values for fuel price and currency
          const oHdr   = this.getView().getBindingContext().getObject();
          const oModel = this.getView().getModel();

          // Fetch car mileage for cost calculation
          const sCarPath = "/" + oModel.createKey("ZbnhCarSet", {
              LicensePlate: oHdr.LicensePlate
          });

          oModel.read(sCarPath, {
              success: oCar => {
                  const fGasmilage = Number(oCar.Gasmilage) || 0;
                  const fCost      = calcCost(oRaw.Distance, fGasmilage, oHdr.GasPrice);

                  // Prepare payload for backend
                  const oPayload = {
                      Username:     "BNEDER",
                      Yyear:        Number(oRaw.Yyear),
                      Mmonth:       oRaw.Mmonth,
                      LicensePlate: oRaw.LicensePlate,
                      Batchid:      getBatchId(),
                      FromAddr:     Number(oRaw.FromAddr),
                      ToAddr:       Number(oRaw.ToAddr),
                      Ddate:        oRaw.Ddate.toISOString().split("T")[0] + "T00:00:00",
                      Distance:     Number(oRaw.Distance),
                      Cost:         String(fCost),
                      Currency:     oHdr.GasCurr,
                      Note:         oRaw.Note
                  };

                  // Create item in backend
                  oModel.create("/TripItemSet", oPayload, {
                      success: () => {
                          MessageToast.show("Item created");
                          this._oCreateItemDlg.close();
                          this.byId("tripItemTable").getBinding("items").refresh();
                      },
                      error: oErr => MessageBox.error(oErr.message)
                  });
              },
              error: oErr => MessageBox.error(oErr.message)
          });
      },

      /**
       * Opens the edit item dialog
       * Lazy-loads dialog and pre-fills with selected item data
       */
      onOpenEditItemDialog: async function () {
          if (!this._oEditItemDlg) {
              this._oEditItemDlg = await Fragment.load({
                  name: "tripjournal.tripjournalui.view.EditItem",
                  controller: this
              });
              this.getView().addDependent(this._oEditItemDlg);
          }
        
          // Get selected item data and create JSON model for editing
          const oCtx  = this.byId("tripItemTable").getSelectedItem().getBindingContext();
          const oJSON = new JSONModel(Object.assign({}, oCtx.getObject()));
          this._oEditItemDlg.setModel(oJSON, "editItem");
          this._oEditItemDlg.open();
      },

      /**
       * Updates an existing trip item
       * Recalculates cost and saves changes to backend
       */
      onUpdateItem: function () {
          const oRaw  = this._oEditItemDlg.getModel("editItem").getData();
          const sPath = this.byId("tripItemTable")
                           .getSelectedItem().getBindingContext().getPath();

          // Get header values for fuel price and currency
          const oHdr   = this.getView().getBindingContext().getObject();
          const oModel = this.getView().getModel();
          const sCarPath = "/" + oModel.createKey("ZbnhCarSet", {
              LicensePlate: oHdr.LicensePlate
          });

          oModel.read(sCarPath, {
              success: oCar => {
                  const fGasmilage = Number(oCar.Gasmilage) || 0;
                  const fCost      = calcCost(oRaw.Distance, fGasmilage, oHdr.GasPrice);

                  // Prepare updated payload
                  const oPayload = Object.assign({}, oRaw, {
                      FromAddr: Number(oRaw.FromAddr),
                      ToAddr:   Number(oRaw.ToAddr),
                      Distance: Number(oRaw.Distance),
                      Cost:     String(fCost),
                      Currency: oHdr.GasCurr
                  });

                  // Update item in backend
                  oModel.update(sPath, oPayload, {
                      merge:   true,
                      success: () => {
                          MessageToast.show("Item updated");
                          this._oEditItemDlg.close();
                      },
                      error:   oErr => MessageBox.error(oErr.message)
                  });
              },
              error: oErr => MessageBox.error(oErr.message)
          });
      },

      /**
       * Cancels item dialog operations
       * @param {sap.ui.base.Event} oEvt - Cancel event
       */
      onCancelItemDialog: function (oEvt) {
          oEvt.getSource().getParent().close();
      },
        
      /**
       * Deletes selected trip items
       * Uses batch operations for efficient deletion of multiple items
       */
      onDeleteSelectedItems: function () {
          const aItems = this.byId("tripItemTable").getSelectedItems();
          if (aItems.length === 0) { 
              return; 
          }
        
          MessageBox.confirm(`Delete ${aItems.length} item(s)?`, {
              onClose: sBtn => {
                  if (sBtn !== MessageBox.Action.OK) { 
                      return; 
                  }
        
                  const oModel = this.getView().getModel();
        
                  // Create batch group for efficient deletion
                  const sGroup = "massDel_" + Date.now();
                  oModel.setDeferredBatchGroups([sGroup]);            
        
                  // Schedule each DELETE with its own change-set
                  aItems.forEach((oIt, idx) => {
                      oModel.remove(
                          oIt.getBindingContext().getPath(),
                          {
                              groupId:     sGroup,                         
                              changeSetId: "cs" + idx                      
                          }
                      );
                  });
        
                  // Send the batch in one go
                  oModel.submitChanges({
                      groupId: sGroup,                                
                      success: () => {
                          MessageToast.show("Deletion finished");        
                          this.byId("tripItemTable").removeSelections();
                          this.byId("delItemBtn").setEnabled(false);
                      },
                      error:   oErr => MessageBox.error(oErr.message)
                  });
              }
          });
      },

      /**
       * Opens address value help dialog
       * Lazy-loads dialog and sets up address selection
       * @param {sap.ui.base.Event} oEvt - Value help request event
       */
      async onAddrValueHelpRequest(oEvt) {
          this._oAddrInput = oEvt.getSource();                       
          const oBind = this._oAddrInput.getBinding("value");
          this._addrPath  = oBind ? oBind.getPath() : "/FromAddr";
          this._addrModel = oBind ? oBind.getModel() : null; 

          // Lazy-load dialog once
          if (!this._oAddrVHD) {
              this._oAddrVHD = await sap.ui.core.Fragment.load({
                  name:      "tripjournal.tripjournalui.view.AddressValueHelpDialog",
                  controller: this
              });
              this.getView().addDependent(this._oAddrVHD);
              this._oAddrVHD.setSupportMultiselect(false);

              // Bind the internal table AFTER it is created
              this._oAddrVHD.getTableAsync().then(function (oTable) {
                  oTable.setModel(this.getView().getModel()); 

                  if (oTable.bindRows) {
                      this._bindAddrRows(oTable);   
                  }
              }.bind(this));
          }
          this._oAddrVHD.open();
      },

      /**
       * Binds address data to table rows
       * Sets up columns and row selection handling
       * @param {sap.ui.table.Table} oTable - Table to bind
       */
      _bindAddrRows: function (oTable) {
          // Add columns for address display
          oTable.addColumn(new sap.ui.table.Column({label: "ID",          template: new sap.m.Label({text: "{Id}"})}));
          oTable.addColumn(new sap.ui.table.Column({label: "Name",        template: new sap.m.Label({text: "{Name}"})}));
          oTable.addColumn(new sap.ui.table.Column({label: "City",        template: new sap.m.Label({text: "{City}"})}));
          oTable.addColumn(new sap.ui.table.Column({label: "Post Code",   template: new sap.m.Label({text: "{PostCode}"})}));
          
          // Bind rows to address data
          oTable.bindRows({
              path:   "/ZbnhAddressSet",
              events: { dataReceived: () => this._oAddrVHD.update() }
          });
          
          // Handle row selection
          oTable.attachRowSelectionChange(this._onAddrRowSelect, this);
      },

      /**
       * Binds address data to table items (alternative binding method)
       * @param {sap.m.Table} oTable - Table to bind
       */
      _bindAddrItems: function (oTable) {
          // Add columns for address display
          oTable.addColumn(new sap.m.Column({header: "ID"}));
          oTable.addColumn(new sap.m.Column({header: "Name"}));
          oTable.addColumn(new sap.m.Column({header: "City"}));
          oTable.addColumn(new sap.m.Column({header: "Post Code"}));
          
          // Bind items to address data
          oTable.bindItems({
              path:     "/ZbnhAddressSet",
              template: new sap.m.ColumnListItem({cells: [
                  new sap.m.Label({text: "{Id}"}),
                  new sap.m.Label({text: "{Name}"}),
                  new sap.m.Label({text: "{City}"}),
                  new sap.m.Label({text: "{PostCode}"})
              ]}),
              events: { dataReceived: () => this._oAddrVHD.update() }
          });
          
          // Handle selection change
          oTable.attachSelectionChange(this._onAddrRowSelect, this);
      },

      /**
       * Handles address filter bar search
       * Creates filters based on user input
       * @param {sap.ui.base.Event} oEvt - Search event
       */
      onAddrFilterBarSearch: function (oEvt) {
          const aCtrls  = oEvt.getParameter("selectionSet") || [],
                aFilter = aCtrls.reduce((a, c) => {
                    if (c.getValue()) {
                        a.push(new sap.ui.model.Filter(c.getName(), sap.ui.model.FilterOperator.Contains, c.getValue()));
                    }
                    return a;
                }, []);
          this._filterAddrTable(aFilter.length ? new sap.ui.model.Filter({filters: aFilter, and: true}) : []);
      },

      /**
       * Applies filters to address table
       * @param {sap.ui.model.Filter} oFilter - Filter to apply
       */
      _filterAddrTable: function (oFilter) {
          this._oAddrVHD.getTableAsync().then(function (oTable) {
              const sAgg = oTable.bindRows ? "rows" : "items";
              oTable.getBinding(sAgg).filter(oFilter);
              this._oAddrVHD.update();
          }.bind(this));
      },

      /**
       * Handles address row selection
       * Extracts selected context and commits selection
       * @param {sap.ui.base.Event} oEvt - Row selection event
       */
      _onAddrRowSelect: function (oEvt) {
          let oCtx;
          const oSrc = oEvt.getSource();
          
          if (oSrc.getSelectedContexts) {           
              oCtx = oSrc.getSelectedContexts()[0];
          } else {                                  
              const iSel = oSrc.getSelectedIndex();
              oCtx = iSel >= 0 ? oSrc.getContextByIndex(iSel) : null;
          }
          
          if (oCtx) { 
              this._commitAddrSelection(oCtx.getObject()); 
          }
      },

      /**
       * Fallback handler for address value help OK button
       * @param {sap.ui.base.Event} oEvt - OK event
       */
      onAddrVhOk: function (oEvt) {
          const aTokens = oEvt.getParameter("tokens") || [];
          if (aTokens.length) {
              this._commitAddrSelection({ Id: aTokens[0].getKey() });
          }
      },

      /**
       * Handles address value help cancel
       */
      onAddrVhCancel: function() { 
          this._oAddrVHD.close(); 
      },

      /**
       * Handles address value help after close
       * Keeps instance for performance
       */
      onAddrVhAfterClose: function() { 
          /* keep instance for speed */ 
      },

      /**
       * Commits address selection to input field
       * @param {Object} oAddr - Selected address object
       */
      _commitAddrSelection: function (oAddr) {
          const sId = String(oAddr.Id);
          this._oAddrInput.setValue(sId);
          
          if (this._addrModel) {
              this._addrModel.setProperty(this._addrPath, Number(sId));
          }
          
          this._oAddrVHD.close();
      }
  });
});