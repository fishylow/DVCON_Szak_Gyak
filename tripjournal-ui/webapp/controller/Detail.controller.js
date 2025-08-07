
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
    return +(qty * Number(fuelPrice)).toFixed(3);                        
  }
  
  /**
   * Converts a JS Date to the backend's yyyy-MM-ddT00:00:00 (local) format
   * without touching time-zone (avoids the ISO shift).
   * @param {Date} d - Local date object
   * @returns {string} yyyy-MM-ddT00:00:00
   */
  function fmtLocalDate(d) {
      const z = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T00:00:00`;
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
  
    // Constants for better maintainability
    const CONSTANTS = {
      SUM_PATH: "summary",
      STATUS_OPEN: "N",
      BATCH_GROUP_PREFIX: "massDel_",
      CHANGESET_PREFIX: "cs",
      ADDRESS_CACHE_MODEL: "addrCache",
      ADDRESS_CACHE_PATH: "/map"
    };
  
    return Controller.extend("tripjournal.tripjournalui.controller.Detail", {
        formatter: formatter,
    
        /**
         * Initializes the Detail controller
         * Sets up routing, summary model, and loads address cache
         * 
         * @function
         * @name onInit
         * @memberof tripjournal.tripjournalui.controller.Detail
         */
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
            
            // Initialize summary model for gas mileage and total cost
            this.getView().setModel(new JSONModel({ Gasmilage: 0, TotalCost: 0 }), CONSTANTS.SUM_PATH);
            
            this._loadAddressCache();
        },
  
        /**
         * Re-computes KmAfter = KmBefore + sum(item.Distance) and PATCH-es it
         * to the TripHeader. Can be called after create / update / delete of items.
         * 
         * @function
         * @name _updateKmAfter
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         */
        _updateKmAfter: function () {
          const oHdrPath = this.getView().getBindingContext().getPath();
          const oModel   = this.getView().getModel();
      
          oModel.read(oHdrPath, {
              urlParameters: { $expand: "to_TripItemSet" },
              success: (oHdr) => {
                  const aItems = (oHdr.to_TripItemSet && oHdr.to_TripItemSet.results) || [];
                  let iKmAfter = Number(oHdr.KmBefore) || 0;
      
                  aItems.forEach(oIt => { iKmAfter += Number(oIt.Distance) || 0; });
                  oModel.update(oHdrPath, { KmAfter: iKmAfter }, { merge: true });
              },
              error: (oErr) => {
                  this._handleBackendError(oErr, "Failed to update kilometers");
              }
          });
      },
  
        /**
         * Loads address data into a shared cache model for performance
         * This cache is shared across the entire application
         * 
         * @function
         * @name _loadAddressCache
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         */
        _loadAddressCache: function () {
            // Get or create shared cache model that lives in core
            const oCache = sap.ui.getCore().getModel(CONSTANTS.ADDRESS_CACHE_MODEL) || 
                          new sap.ui.model.json.JSONModel({ map: {} });
            sap.ui.getCore().setModel(oCache, CONSTANTS.ADDRESS_CACHE_MODEL);
        
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
                        oCache.setProperty(CONSTANTS.ADDRESS_CACHE_PATH, m);
                    },
                    error: (oErr) => {
                        this._handleBackendError(oErr, "Failed to load address cache");
                    }
                });
            }.bind(this));
        },
  
        /**
         * Recalculates and updates the summary model (TotalCost, etc.)
         * Sums the Cost of all trip items and updates the summary model
         * Should be called after loading, creating, updating, or deleting trip items
         *
         * @function
         * @name _updateSummary
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         */
        _updateSummary: function () {
            const oHdrPath = this.getView().getBindingContext().getPath();
            const oModel   = this.getView().getModel();
            const oSum     = this.getView().getModel(CONSTANTS.SUM_PATH);

            oModel.read(oHdrPath, {
                urlParameters: { $expand: "to_TripItemSet" },
                success: (oHdr) => {
                    const aItems = (oHdr.to_TripItemSet && oHdr.to_TripItemSet.results) || [];
                    // Sum up all item costs, handling missing or non-numeric values
                    const totalCost = aItems.reduce((sum, oIt) => {
                        const cost = Number(oIt.Cost);
                        return sum + (isNaN(cost) ? 0 : cost);
                    }, 0);
                    oSum.setProperty("/TotalCost", totalCost);
                },
                error: (oErr) => {
                    this._handleBackendError(oErr, "Failed to update summary");
                }
            });
        },
  
        /**
         * Handles route pattern matching when navigating to detail page
         * Binds trip header and items, then calculates summary data
         * 
         * @function
         * @name _onObjectMatched
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         * @param {sap.ui.base.Event} oEvent - Route matching event
         */
        _onObjectMatched: function (oEvent) {
            const sUsername     = oEvent.getParameter("arguments").username;
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
            const oSum   = this.getView().getModel(CONSTANTS.SUM_PATH);
      
            oModel.metadataLoaded().then(() => {
                // Read header with items to calculate total cost
                oModel.read(sHdrPath, {
                  success: oHdr => {
                    const bOpen = oHdr.Status === CONSTANTS.STATUS_OPEN;
                    this._bOpen = bOpen;
                    this.byId("_IDGenButton").setEnabled(bOpen);
                    this.byId("editItemBtn").setEnabled(false);    
                    this.byId("delItemBtn").setEnabled(false);
                    // Update summary after loading header and items
                    this._updateSummary();
                  },
                  error: (oErr) => {
                      this._handleBackendError(oErr, "Failed to load trip header");
                  }
                });
      
                // Read car data to get fuel consumption
                oModel.read("/ZbnhCarSet('" + sLicensePlate + "')", {
                    success: oCar => oSum.setProperty("/Gasmilage", oCar.Gasmilage),
                    error: (oErr) => {
                        this._handleBackendError(oErr, "Failed to load car data");
                    }
                });
            });
        },
  
        /**
         * Handles navigation back to previous page
         * Uses browser history if available, otherwise navigates to trip journal
         * 
         * @function
         * @name onNavBack
         * @memberof tripjournal.tripjournalui.controller.Detail
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
         * 
         * @function
         * @name onItemSelectionChange
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @param {sap.ui.base.Event} oEvt - Selection change event
         */
        onItemSelectionChange: function (oEvt) {
          const aSel = oEvt.getSource().getSelectedItems();
          this.byId("editItemBtn").setEnabled(this._bOpen && aSel.length === 1);
          this.byId("delItemBtn").setEnabled(this._bOpen && aSel.length > 0);
        },
  
        /**
         * Opens the create item dialog
         * Lazy-loads the dialog fragment and pre-fills with header data
         * 
         * @function
         * @name onOpenCreateItemDialog
         * @memberof tripjournal.tripjournalui.controller.Detail
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
                        Username:     oHdr.Username,
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
         * 
         * @function
         * @name onCreateItem
         * @memberof tripjournal.tripjournalui.controller.Detail
         */
        onCreateItem: function () {
            const oRaw = this._oCreateItemDlg.getModel("createItem").getData();
  
            const oHdr       = this.getView().getBindingContext().getObject();
            const d          = oRaw.Ddate instanceof Date ? oRaw.Ddate : new Date(oRaw.Ddate);
            const iHdrYear   = Number(oHdr.Yyear);
            const iHdrMonth  = Number(oHdr.Mmonth);
  
            // Validate date is within trip header period
            if (d.getFullYear() !== iHdrYear || (d.getMonth() + 1) !== iHdrMonth) {
                  const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                  return MessageBox.error(
                      oI18n.getText("msgDateValidationError", [iHdrYear, String(iHdrMonth).padStart(2, "0")])
                  );
            }
            
            // Validate that from and to addresses are different
            if (oRaw.FromAddr === oRaw.ToAddr) {
                const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                return MessageBox.error(oI18n.getText("msgAddressValidationError"));
            }
  
            // Get header values for fuel price and currency
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
                        Username:     oRaw.Username,
                        Yyear:        Number(oRaw.Yyear),
                        Mmonth:       oRaw.Mmonth,
                        LicensePlate: oRaw.LicensePlate,
                        Batchid:      getBatchId(),
                        FromAddr:     Number(oRaw.FromAddr),
                        ToAddr:       Number(oRaw.ToAddr),
                        Ddate:        fmtLocalDate(oRaw.Ddate),
                        Distance:     Number(oRaw.Distance),
                        Cost:         String(fCost),
                        Currency:     oHdr.GasCurr,
                        Note:         oRaw.Note
                    };
  
                    // Create item in backend
                    oModel.create("/TripItemSet", oPayload, {
                        success: () => {
                            const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                            MessageToast.show(oI18n.getText("msgItemCreated"));
                            this._oCreateItemDlg.close();
                            // Clear model after close
                            const oHdr = this.getView().getBindingContext().getObject();
                            const oData = {
                                Username:     oHdr.Username,
                                Yyear:        oHdr.Yyear,
                                Mmonth:       oHdr.Mmonth,
                                LicensePlate: oHdr.LicensePlate,
                                FromAddr:     null,
                                ToAddr:       null,
                                Ddate:        new Date(),
                                Distance:     null,
                                Note:         ""
                            };
                            this._oCreateItemDlg.setModel(new JSONModel(oData), "createItem");
                            this.byId("tripItemTable").getBinding("items").refresh();
                            this._updateKmAfter();
                            this._updateSummary();
                        },
                        error: oErr => this._handleBackendError(oErr, "Failed to create item")
                    });
                },
                error: oErr => this._handleBackendError(oErr, "Failed to load car data")
            });
        },
  
        /**
         * Opens the edit item dialog
         * Lazy-loads dialog and pre-fills with selected item data
         * 
         * @function
         * @name onOpenEditItemDialog
         * @memberof tripjournal.tripjournalui.controller.Detail
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
         * 
         * @function
         * @name onUpdateItem
         * @memberof tripjournal.tripjournalui.controller.Detail
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
                            const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                            MessageToast.show(oI18n.getText("msgItemUpdated"));
                            this._oEditItemDlg.close();
                            // Clear model after close
                            this._oEditItemDlg.setModel(new JSONModel({}), "editItem");
                            this._updateKmAfter();
                            this._updateSummary();
                        },
                        error:   oErr => this._handleBackendError(oErr, "Failed to update item")
                    });
                },
                error: oErr => this._handleBackendError(oErr, "Failed to load car data")
            });
        },
  
        /**
         * Cancels item dialog operations
         * 
         * @function
         * @name onCancelItemDialog
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @param {sap.ui.base.Event} oEvt - Cancel event
         */
        onCancelItemDialog: function (oEvt) {
            // Close the dialog
            oEvt.getSource().getParent().close();
            // Clear dialog models to prevent data persistence
            if (this._oCreateItemDlg && this._oCreateItemDlg.isOpen()) {
                // Reset to default structure as in onOpenCreateItemDialog
                const oHdr = this.getView().getBindingContext().getObject();
                const oData = {
                    Username:     oHdr.Username,
                    Yyear:        oHdr.Yyear,
                    Mmonth:       oHdr.Mmonth,
                    LicensePlate: oHdr.LicensePlate,
                    FromAddr:     null,
                    ToAddr:       null,
                    Ddate:        new Date(),
                    Distance:     null,
                    Note:         ""
                };
                this._oCreateItemDlg.setModel(new JSONModel(oData), "createItem");
            }
            if (this._oEditItemDlg && this._oEditItemDlg.isOpen()) {
                this._oEditItemDlg.setModel(new JSONModel({}), "editItem");
            }
        },
          
        /**
         * Deletes selected trip items
         * Uses batch operations for efficient deletion of multiple items
         * 
         * @function
         * @name onDeleteSelectedItems
         * @memberof tripjournal.tripjournalui.controller.Detail
         */
        onDeleteSelectedItems: function () {
            const aItems = this.byId("tripItemTable").getSelectedItems();
            if (aItems.length === 0) { 
                return; 
            }
          
            const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            MessageBox.confirm(oI18n.getText("msgDeleteConfirmation", [aItems.length]), {
                onClose: sBtn => {
                    if (sBtn !== MessageBox.Action.OK) { 
                        return; 
                    }
          
                    const oModel = this.getView().getModel();
          
                    // Create batch group for efficient deletion
                    const sGroup = CONSTANTS.BATCH_GROUP_PREFIX + Date.now();
                    oModel.setDeferredBatchGroups([sGroup]);            
          
                    // Schedule each DELETE with its own change-set
                    aItems.forEach((oIt, idx) => {
                        oModel.remove(
                            oIt.getBindingContext().getPath(),
                            {
                                groupId:     sGroup,                         
                                changeSetId: CONSTANTS.CHANGESET_PREFIX + idx                      
                            }
                        );
                    });
          
                    // Send the batch in one go
                    oModel.submitChanges({
                        groupId: sGroup,                                
                        success: () => {
                            MessageToast.show(oI18n.getText("msgDeletionFinished"));        
                            this.byId("tripItemTable").removeSelections();
                            this.byId("delItemBtn").setEnabled(false);
                            this._updateKmAfter();
                            this._updateSummary();
                        },
                        error:   oErr => this._handleBackendError(oErr, "Failed to delete items")
                    });
                }
            });
        },
  
        /**
         * Opens address value help dialog
         * Lazy-loads dialog and sets up address selection
         * 
         * @function
         * @name onAddrValueHelpRequest
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @param {sap.ui.base.Event} oEvt - Value help request event
         */
        async onAddrValueHelpRequest(oEvt) {
          this._oAddrInput = oEvt.getSource();
          const oBind = this._oAddrInput.getBinding("value");   
          this._addrDispPath = oBind ? oBind.getPath()  : "/FromAddrDisp";  
          this._addrIdPath   = this._addrDispPath.replace(/Disp$/, "");     
          this._addrModel    = oBind ? oBind.getModel() : null; 
  
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
         * 
         * @function
         * @name _bindAddrRows
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
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
         * 
         * @function
         * @name _bindAddrItems
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
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
         * 
         * @function
         * @name onAddrFilterBarSearch
         * @memberof tripjournal.tripjournalui.controller.Detail
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
         * 
         * @function
         * @name _filterAddrTable
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
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
         * 
         * @function
         * @name _onAddrRowSelect
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
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
         * 
         * @function
         * @name onAddrVhOk
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @param {sap.ui.base.Event} oEvt - OK event
         */
        onAddrVhOk: function (oEvt) {
          const aTokens = oEvt.getParameter("tokens") || [];
          if (aTokens.length) {
            this._commitAddrSelection({
              Id:   aTokens[0].getKey(),
              Name: aTokens[0].getText()  
            });
          }
        },
  
        /**
         * Handles address value help cancel
         * 
         * @function
         * @name onAddrVhCancel
         * @memberof tripjournal.tripjournalui.controller.Detail
         */
        onAddrVhCancel: function() { 
            this._oAddrVHD.close(); 
        },
  
        /**
         * Handles address value help after close
         * Keeps instance for performance
         * 
         * @function
         * @name onAddrVhAfterClose
         * @memberof tripjournal.tripjournalui.controller.Detail
         */
        onAddrVhAfterClose: function() { 
            /* keep instance for speed */ 
        },
  
        /**
         * Commits address selection to input field
         * 
         * @function
         * @name _commitAddrSelection
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         * @param {Object} oAddr - Selected address object
         */
        _commitAddrSelection: function (oAddr) {
          const sId   = String(oAddr.Id);
          const sName = oAddr.Name || sId;
        
          // show the NAME in the visible field
          this._oAddrInput.setValue(sName);
        
          // set both display and ID in the model so we still post the numeric ID
          if (this._addrModel) {
            this._addrModel.setProperty(this._addrDispPath, sName);     
            this._addrModel.setProperty(this._addrIdPath,   Number(sId)); 
          }
        
          this._oAddrVHD.close();
        },
  
        /**
         * Handles manual address input changes
         * Validates input and updates model accordingly
         * 
         * @function
         * @name onAddrManualChange
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @param {sap.ui.base.Event} oEvt - Input change event
         */
        onAddrManualChange: function (oEvt) {
          const sVal   = (oEvt.getParameter("value") || "").trim();
          const oBind  = oEvt.getSource().getBinding("value"); 
          const oModel = oBind.getModel();
          const sDisp  = oBind.getPath();             
          const sId    = sDisp.replace(/Disp$/, "");  
        
          // Always keep the typed text in the *display* property
          oModel.setProperty(sDisp, sVal);
        
          // If the typed text is an integer, mirror it to the ID property; otherwise clear ID
          if (sVal === "") {
            oModel.setProperty(sId, null);
          } else if (/^\d+$/.test(sVal)) {
            oModel.setProperty(sId, Number(sVal));
          } else {
            // Non-numeric manual entry -> not a valid ID; do not post a stale ID
            oModel.setProperty(sId, null);
          }
        },
  
        /**
         * Centralized error handling for backend operations
         * Displays user-friendly error messages with i18n support
         * 
         * @function
         * @name _handleBackendError
         * @memberof tripjournal.tripjournalui.controller.Detail
         * @private
         * @param {Object} oErr - Error object from backend
         * @param {string} sContext - Context description for the error
         */
        _handleBackendError: function(oErr, sContext) {
            const oI18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sErrorMessage = oErr.message || oErr.responseText || oErr.statusText || "Unknown error";
            const sFormattedError = oI18n.getText("errorBackendError", [sErrorMessage]);
            
            MessageBox.error(sFormattedError, {
                title: sContext,
                details: oErr.responseText || oErr.message || ""
            });
        }
        
    });
  });