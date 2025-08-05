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
        const aYears = [{ key:"", text:oI18n.getText("filter.none") }]
            .concat(Array.from({length:7}, (_,i)=> {
                const y = iNow - 5 + i;
                return { key: String(y), text: String(y) };
            }));
        this.getView().setModel(new JSONModel(aYears), "years");
    
        // MONTHS
        const aMonths = [{ key:"", text:oI18n.getText("filter.none") }]
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
          const sStatus = oView.byId("statusFilter").getSelectedKey();
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
          this.byId("editHeaderBtn").setEnabled(aSel.length === 1);   
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
          oData.setAutoExpandSelect(true);
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
              Username:     "BNEDER",          // Temporarily using own user
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
    }
  });
});