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

      /**
       * Initializes the TripJournal controller
       * Currently empty but available for future initialization logic
       */
      onInit: function () {
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
          const oDateRange = oView.byId("dateFilter");
          const dFromDate = oDateRange.getDateValue();
          const dToDate = oDateRange.getSecondDateValue();
          const sLicensePlate = oView.byId("licensePlateFilter").getValue();
          const oTable = oView.byId("tripHeaderTable");
          const oBinding = oTable.getBinding("items");

          const aFilters = [];

          // Add status filter if selected
          if (sStatus) {
              aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus));
          }

          // Add license plate filter if entered
          if (sLicensePlate) {
              aFilters.push(new Filter("LicensePlate", FilterOperator.Contains, sLicensePlate));
          }

          // Add date filter if both dates are selected
          if (dFromDate && dToDate) {
              // For simplicity, we'll filter by Year for now.
              // A proper implementation would need to handle year and month ranges.
              aFilters.push(new Filter("Yyear", FilterOperator.EQ, dFromDate.getFullYear()));
          }

          oBinding.filter(aFilters);
      },

      /**
       * Clears all filters and refreshes the table binding
       * Resets filter controls to default state
       */
      onClearFilter: function () {
          const oView = this.getView();
          
          // Reset all filter controls
          oView.byId("statusFilter").setSelectedKey("");
          oView.byId("dateFilter").setValue("");
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
      }
  });
});