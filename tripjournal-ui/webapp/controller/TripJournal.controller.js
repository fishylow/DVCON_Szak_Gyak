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
    
      _initYearMonthModels: function () {
        const iNow   = new Date().getFullYear(),
              oI18n  = this.getOwnerComponent().getModel("i18n").getResourceBundle();
    
        // YEARS
        const aYears = [{ key:"", text:oI18n.getText("filter.noneYear") }]
            .concat(Array.from({length:7}, (_,i)=> {
                const y = iNow - 5 + i;
                return { key: String(y), text: String(y) };
            }));
        this.getView().setModel(new JSONModel(aYears), "years");
    
        // MONTHS
        const aMonths = [{ key:"", text:oI18n.getText("filter.noneMonth") }]
            .concat(Array.from({length:12}, (_,i)=> {
                const k = String(i+1).padStart(2,"0");
                return { key:k, text:oI18n.getText("month."+k) };
            }));
        this.getView().setModel(new JSONModel(aMonths), "months");
    },

      /**
       * Initializes the TripJournal controller
       * Currently empty but available for future initialization logic
       */
      onInit: function () {
        this._initYearMonthModels();
      },

      /**
       * Handles navigation to the Details page when a trip is selected
       * Extracts trip data and navigates with route parameters
       * @param {sap.ui.base.Event} oEvent - Click event from trip selection
       */
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
       * Filters the trip header table based on user input
       * Applies filters for status, date range, and license plate
       */
      onFilterTrips: function () {
          const oView = this.getView();
          const sStatus = oView.byId("selStatus").getSelectedKey();
          const oTable = oView.byId("tripHeaderTable");
          const oBinding = oTable.getBinding("items");

          const sYear   = oView.byId("yearFilter").getSelectedKey();
          const sMonth  = oView.byId("monthFilter").getSelectedKey();
          const sPlate  = oView.byId("licensePlateFilter").getValue().toUpperCase();

          const aFilters = [];
          if (sStatus) {  aFilters.push(new Filter("Status",        FilterOperator.EQ, sStatus)); }
          if (sPlate) {   aFilters.push(new Filter("LicensePlate",  FilterOperator.Contains, sPlate)); }
          if (sYear)  {   aFilters.push(new Filter("Yyear",         FilterOperator.EQ, sYear));  }
          if (sMonth) {   aFilters.push(new Filter("Mmonth",        FilterOperator.EQ, sMonth)); }

        oBinding.filter(aFilters);

      },

      /**
       * Clears all filters and refreshes the table binding
       * Resets filter controls to default state
       */
      onClearFilter: function () {
          const oView = this.getView();
          
          // Reset all filter controls
          oView.byId("yearFilter").setSelectedKey("");
          oView.byId("monthFilter").setSelectedKey("");
          oView.byId("licensePlateFilter").setValue("");
          oView.byId("selStatus").setSelectedKey("");


          // Clear table filters
          const oTable = oView.byId("tripHeaderTable");
          const oBinding = oTable.getBinding("items");
          oBinding.filter([]);
      },

      /**
       * Handles selection change in the trip header table
       * Enables/disables edit button based on selection count
       * @param {sap.ui.base.Event} oEvt - Selection change event
       */
      onSelectionChange: function (oEvt) {
        const aSel = oEvt.getSource().getSelectedItems();
        const bSingle = aSel.length === 1;
      
        // enable edit only if single-select AND status is open
        const bOpen = bSingle &&
                      aSel[0].getBindingContext().getProperty("Status") === "N";
      
        this.byId("editHeaderBtn").setEnabled(bOpen);
        this.byId("changeStatusBtn").setEnabled(aSel.length > 0);
      },

      /**
       * Opens the edit header dialog
       * Lazy-loads dialog and pre-fills with selected trip data
       */
      onOpenEditHeaderDialog: async function () {
          if (!this._oEditDialog) {
              const oDlg = await Fragment.load({
                  name: "tripjournal.tripjournalui.view.EditHeader",       
                  controller: this
              });                                                       
              this.getView().addDependent(oDlg);
              this._oEditDialog = oDlg;
          }
        
          // Pre-fill JSON model with the ONLY editable fields
          const oCtx   = this.byId("tripHeaderTable").getSelectedItem().getBindingContext();
          const oData  = Object.assign({}, oCtx.getObject());
          const oJSON  = new JSONModel(oData);
          this._oEditDialog.setModel(oJSON, "edit");
          this._oEditDialog.open();
      },

      /**
       * Updates trip header information
       * Saves changes to backend and shows success message
       */
      onUpdateHeader: function () {
          const oData = this._oEditDialog.getModel("edit").getData();
          const sPath = this.byId("tripHeaderTable")
                           .getSelectedItem().getBindingContext().getPath();
        
          this.getView().getModel().update(
              sPath,
              {
                  KmBefore: Number(oData.KmBefore),
                  GasPrice: Number(oData.GasPrice).toFixed(3),
                  GasCurr:  oData.GasCurr
              },
              {
                  success: () => {
                      MessageToast.show("Header updated");                   
                      this._oEditDialog.close();
                  },
                  error: oErr => MessageBox.error(oErr.message)
              });
      },          

      /**
       * Opens the create trip dialog
       * Lazy-loads dialog and initializes with default values
       */
      onOpenCreateDialog: function () {
          // Lazy-load the fragment
          if (!this._oCreateDialog) {
              Fragment.load({
                  name: "tripjournal.tripjournalui.view.CreateTrip",
                  controller: this
              }).then(function (oDialog) {
                  this.getView().addDependent(oDialog);
    
                  // Initialize JSONModel for the input fields with default values
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
    
      /**
       * Closes the create trip dialog
       */
      onCloseCreateDialog: function () {
          this._oCreateDialog.close();
      },

      /**
       * Cancels header dialog operations
       * @param {sap.ui.base.Event} oEvt - Cancel event
       */
      onCancelHeaderDialog: function (oEvt) {
          oEvt.getSource().getParent().close();
      },
      
      /**
       * Creates a new trip header
       * Validates input and saves to backend
       */
      onCreateTrip: function () {
          // Read data from the model
          const oCreate = this._oCreateDialog.getModel("create").getData();
      
          const sGasPrice = Number(oCreate.GasPrice || 0).toFixed(3);          
          // Compose payload for backend
          const oPayload = {
              Username:     getCurrentUser(),         
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
      
          // Create header in backend
          this.getView().getModel().create("/TripHeaderSet", oPayload, {
              success: function () {
                  sap.m.MessageToast.show("New trip created");
                  this._oCreateDialog.close();
                  // Refresh header list
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
      },

      /**
       * Opens address value help dialog
       * Lazy-loads dialog and sets up address selection
       * @param {sap.ui.base.Event} oEvt - Value help request event
       */
      async onAddrValueHelpRequest(oEvt) {
          this._oAddrInput = oEvt.getSource();            

          if (!this._oAddrVHD) {
              this._oAddrVHD = await sap.ui.core.Fragment.load({
                  name: "tripjournal.tripjournalui.view.AddressValueHelpDialog",
                  controller: this
              });
              this.getView().addDependent(this._oAddrVHD);
              this._oAddrVHD.setSupportMultiselect(false);

              // Bind table after dialog table becomes available
              this._oAddrVHD.getTableAsync().then(function(oTable) {
                  oTable.setModel(this.getView().getModel());
                  const fnBind = oTable.bindRows ? this._bindAddrRows : this._bindAddrItems;
                  fnBind.call(this, oTable);
              }.bind(this));
          }
          this._oAddrVHD.open();
      },

      /**
       * Handles address value help selection
       * Reacts to built-in SELECT event
       * @param {sap.ui.base.Event} oEvt - Selection event
       */
      onAddrVhSelect(oEvt) {
          const aTokens = oEvt.getParameter("tokens");
          if (aTokens && aTokens.length) {
              const oChosen = {Id: aTokens[0].getKey(), Name: aTokens[0].getText()};
              this._commitAddrSelection(oChosen);
          }
      },

      /**
       * Handles address value help cancel
       */
      onAddrVhCancel() { 
          this._oAddrVHD.close(); 
      },

      /**
       * Handles address value help after close
       * Keeps instance for performance
       */
      onAddrVhAfterClose() { 
          // Keep instance for speed
      },

      /**
       * Commits address selection to input field
       * @param {Object} oAddr - Selected address object
       */
      _commitAddrSelection(oAddr) {
          this._oAddrInput.setValue(oAddr.Id);
          const sPath = this._oAddrInput.getBinding("value").getContext().getPath();
          const oModel = this.getView().getModel("edit");
          oModel.setProperty(sPath, Number(oAddr.Id));
          this._oAddrVHD.close();
      },

    /* ============================================================ */
    /* ==============  CAR   VALUE-HELP  HANDLERS  ================= */
    /* ============================================================ */

    /**
     * Opens the car value-help dialog (lazy-loads on first use)
     * @param {sap.ui.base.Event} oEvt – value-help request event
     */
    async onCarValueHelpRequest(oEvt) {
        // remember the input that triggered the VH – we'll write back to it later
        this._oCarInput = oEvt.getSource();

        // keep model + path so we can update JSONModel as well
        const oBind     = this._oCarInput.getBinding("value");
        this._carPath   = oBind ? oBind.getPath()   : "/LicensePlate";
        this._carModel  = oBind ? oBind.getModel() : null;

        if (!this._oCarVHD) {
            // lazy-load only once
            this._oCarVHD = await sap.ui.core.Fragment.load({
                name:      "tripjournal.tripjournalui.view.CarValueHelpDialog",
                controller: this
            });
            this.getView().addDependent(this._oCarVHD);
            this._oCarVHD.setSupportMultiselect(false);

            // bind the internal table after it's ready
            this._oCarVHD.getTableAsync().then(oTable => {
                oTable.setModel(this.getView().getModel());  // ODataModel
                const fnBind = oTable.bindRows ? this._bindCarRows : this._bindCarItems;
                fnBind.call(this, oTable);
            });
        }
        this._oCarVHD.open();
    },

    /* ------------------------------ *
    * table builders (rows / items)  *
    * ------------------------------ */
    _bindCarRows(oTable) {
        // columns
        oTable.addColumn(new sap.ui.table.Column({label: "Plate",        template: new sap.m.Label({text: "{LicensePlate}"})}));
        oTable.addColumn(new sap.ui.table.Column({label: "Make",         template: new sap.m.Label({text: "{Manufacturer}"})}));
        oTable.addColumn(new sap.ui.table.Column({label: "Model",        template: new sap.m.Label({text: "{Type}"})}));
        oTable.addColumn(new sap.ui.table.Column({label: "Consumption",  template: new sap.m.Label({text: "{Gasmilage} l/100km"})}));

        // data
        oTable.bindRows({
            path:   "/ZbnhCarSet",
            events: { dataReceived: () => this._oCarVHD.update() }
        });

        oTable.attachRowSelectionChange(this._onCarRowSelect, this);
    },

    _bindCarItems(oTable) {
        oTable.addColumn(new sap.m.Column({header: "Plate"}));
        oTable.addColumn(new sap.m.Column({header: "Make"}));
        oTable.addColumn(new sap.m.Column({header: "Model"}));
        oTable.addColumn(new sap.m.Column({header: "Consumption"}));

        oTable.bindItems({
            path:     "/ZbnhCarSet",
            template: new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Label({text: "{LicensePlate}"}),
                    new sap.m.Label({text: "{Manufacturer}"}),
                    new sap.m.Label({text: "{Type}"}),
                    new sap.m.Label({text: "{Gasmilage} l/100km"})
                ]
            }),
            events: { dataReceived: () => this._oCarVHD.update() }
        });

        oTable.attachSelectionChange(this._onCarRowSelect, this);
    },

    /* ------------------ *
    * filter-bar search  *
    * ------------------ */
    onCarFilterBarSearch(oEvt) {
        const aCtrls  = oEvt.getParameter("selectionSet") || [];
        const aFlt = aCtrls.reduce((a,c)=>{
            if (c.getValue()) {
                a.push(new sap.ui.model.Filter(c.getName(),
                        sap.ui.model.FilterOperator.Contains,
                        c.getValue()));
            }
            return a;
        }, []);
        const oFilter = aFlt.length ? new sap.ui.model.Filter({filters:aFlt, and:true}) : [];
        this._filterCarTable(oFilter);
    },

    _filterCarTable(oFilter) {
        this._oCarVHD.getTableAsync().then(oTable=>{
            const sAgg = oTable.bindRows ? "rows" : "items";
            oTable.getBinding(sAgg).filter(oFilter);
            this._oCarVHD.update();
        });
    },

    /* ----------------------- *
    * selection + callbacks   *
    * ----------------------- */
    _onCarRowSelect(oEvt) {
        let oCtx;
        const oSrc = oEvt.getSource();
        if (oSrc.getSelectedContexts) {                   // sap.ui.table.Table
            oCtx = oSrc.getSelectedContexts()[0];
        } else {                                          // sap.m.Table
            const iSel = oSrc.getSelectedIndex();
            oCtx = iSel >= 0 ? oSrc.getContextByIndex(iSel) : null;
        }
        if (oCtx) { this._commitCarSelection(oCtx.getObject()); }
    },

    onCarVhOk(oEvt) {
        const aTokens = oEvt.getParameter("tokens") || [];
        if (aTokens.length) {
            this._commitCarSelection({ LicensePlate: aTokens[0].getKey() });
        }
    },

    onCarVhCancel()  { this._oCarVHD.close(); },
    onCarVhAfterClose() { /* keep instance for reuse */ },

    /**
     * Writes chosen plate back to input + JSON model
     * @param {object} oCar – selected car object
     */
    _commitCarSelection(oCar) {
        const sPlate = oCar.LicensePlate;
        this._oCarInput.setValue(sPlate);
        if (this._carModel) {
            this._carModel.setProperty(this._carPath, sPlate);
        }
        this._oCarVHD.close();
    },
    
    /* === Lazy-load & open dialog =========================================== */
    onOpenChangeStatusDialog: async function () {
        if (!this._oChangeStatDlg) {
            this._fragId        = "changeStatusFrag";              // <── save it
            this._oChangeStatDlg = await Fragment.load({
              id         : this._fragId,                           // ⭐ NEW
              name       : "tripjournal.tripjournalui.view.ChangeStatusDialog",
              controller : this
            });
            this.getView().addDependent(this._oChangeStatDlg);
          }
          this._oChangeStatDlg.open();
    },
    
    onChangeStatusConfirm: function () {
        const oTable     = this.byId("tripHeaderTable");
        const aCtxs      = oTable.getSelectedItems().map(i => i.getBindingContext());
        if (!aCtxs.length) { return; }
      
        // read dialog fields via Fragment.byId (dialog lives in a fragment)
        const sKeyDlgId  = this._fragId; // saved at fragment load
        const sNewStat   = Fragment.byId(sKeyDlgId, "statusSelect").getSelectedKey();
        const sNote      = Fragment.byId(sKeyDlgId, "statusNote").getValue();
      
        if (!sNewStat) {
            MessageToast.show(this.getText("msgSelectStat"));           // UX guard
            return;
        }
      
        /* ---- build batch exactly like onDeleteSelectedItems() ---- */
        const oModel  = this.getView().getModel();
        const sGroup  = "massStat_" + Date.now();                       // unique id
        oModel.setDeferredBatchGroups([sGroup]);                        // queue ops
      
        aCtxs.forEach((oCtx, idx) => {
          oModel.update(
            oCtx.getPath(),                                            // /TripHeaderSet(...)
            { Status: sNewStat, Note: sNote },                         // payload
            {
              merge      : true,                                       // MERGE verb
              groupId    : sGroup,
              changeSetId: "cs" + idx                                  // own changeset
            }
          );
        });
      
        oModel.submitChanges({
          groupId: sGroup,
          success: () => {
            oTable.removeSelections();                                 // reset UI
            this.byId("changeStatusBtn").setEnabled(false);
            oModel.refresh(true);                                      // pull fresh data
          },
          error  : oErr => MessageBox.error(oErr.message)
        });
      
        this._oChangeStatDlg.close();
      },
    
    onChangeStatusCancel: function () { this._oChangeStatDlg.close(); },

    /* ============================================================ */
    /* ============  CURRENCY   VALUE-HELP  HANDLERS  ==============*/
    /* ============================================================ */
    async onCurrValueHelpRequest(oEvt) {
        this._oCurrInput = oEvt.getSource();                       // remember control
        const oBind      = this._oCurrInput.getBinding("selectedKey") ||
                        this._oCurrInput.getBinding("value");
        this._currPath   = oBind ? oBind.getPath()  : "/GasCurr";
        this._currModel  = oBind ? oBind.getModel() : null;
    
        if (!this._oCurrVHD) {                                     // lazy-load once
        this._oCurrVHD = await sap.ui.core.Fragment.load({
            name      : "tripjournal.tripjournalui.view.CurrencyValueHelpDialog",
            controller: this
        });
        this.getView().addDependent(this._oCurrVHD);
    
        // bind internal table when available
        this._oCurrVHD.getTableAsync().then(oTable => {
            oTable.setModel(this.getView().getModel());            // share ODataModel
            const fnBind = oTable.bindRows ? this._bindCurrRows : this._bindCurrItems;
            fnBind.call(this, oTable);
        });
        }
        this._oCurrVHD.open();
    },
    
    _bindCurrRows(oTable) {                    // UI5 table
        oTable.addColumn(new sap.ui.table.Column({
          label : "Currency",
          template : new sap.m.Label({ text : "{Waers}"})
        }));
        oTable.bindRows({
          path   : "/ZbnhCurrencySet",
          events : { dataReceived : () => this._oCurrVHD.update() }
        });
        oTable.attachRowSelectionChange(this._onCurrRowSelect, this);
      },
    
      _bindCurrItems(oTable) {                   // responsive m.Table
        oTable.addColumn(new sap.m.Column({ header : "Currency" }));
        oTable.bindItems({
          path    : "/ZbnhCurrencySet",
          template: new sap.m.ColumnListItem({
            cells : [ new sap.m.Label({ text : "{Waers}"}) ]
          }),
          events  : { dataReceived : () => this._oCurrVHD.update() }
        });
        oTable.attachSelectionChange(this._onCurrRowSelect, this);
      },
    
    _onCurrRowSelect(oEvt){
        const oCtx = (oEvt.getSource().getSelectedContexts?.()[0]) ||
                    oEvt.getSource().getContextByIndex(oEvt.getSource().getSelectedIndex());
        if (oCtx){ this._commitCurrSelection(oCtx.getObject()); }
    },
    
    onCurrFilterBarSearch(oEvt){
        const sVal = (oEvt.getParameter("selectionSet")[0] || {}).getValue();
        const oF   = sVal ? new Filter("Waers", FilterOperator.Contains, sVal) : [];
        this._filterCurrTable(oF);
      },
    
    _filterCurrTable(oFilter){
        this._oCurrVHD.getTableAsync().then(oTable=>{
        const sAgg = oTable.bindRows ? "rows" : "items";
        oTable.getBinding(sAgg).filter(oFilter);
        this._oCurrVHD.update();
        });
    },
    
    onCurrVhOk(oEvt){
        const aTok = oEvt.getParameter("tokens") || [];
        if (aTok.length){ this._commitCurrSelection({Waers:aTok[0].getKey()}); }
    },
    onCurrVhCancel(){ this._oCurrVHD.close(); },
    onCurrVhAfterClose(){ /* keep instance */ },
    
    _commitCurrSelection(oCur){
        const sKey = oCur.Waers;
        // write back to the triggering control
        if (this._oCurrInput.setSelectedKey){         // ComboBox / Select
            this._oCurrInput.setSelectedKey(sKey);
        } else {
            this._oCurrInput.setValue(sKey);          // Input fallback
        }
        // push into JSON model if dialog lives inside create/edit
        if (this._currModel){ this._currModel.setProperty(this._currPath, sKey); }
        this._oCurrVHD.close();
    },
  });
});