sap.ui.define([], function () {
    "use strict";

    function _number(x) { return Number(x) || 0; }
    return {
        /**
         * Formats the status code to a semantic color state.
         * @param {string} sStatus The status code from the backend (e.g., 'N', 'A', 'R')
         * @returns {sap.ui.core.ValueState} The corresponding ValueState
         */
        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case 'A': // Approved
                    return "Success";
                case 'R': // Rejected
                    return "Error";
                case 'N': // New/Nyitott
                    return "Warning";
                default:
                    return "None";
            }
        },

        /**
         * This is a placeholder.
         * Will later improve this to read from the ZbnhStatusSet model.
         * @param {string} sStatus The status code from the backend
         * @returns {string} The status text
         */
        formatStatusText: function (sStatus) {
             // For now, a simple mapping. Will improve this later.
            switch (sStatus) {
                case 'A':
                    return "Approved";
                case 'R':
                    return "Rejected";
                case 'N':
                    return "Nyitott";
                default:
                    return sStatus;
            }
        },

        formatItemCount: function (oNavProperty) {
            return oNavProperty.length; 
        },

        formatKmAfter(iKmBefore, aKeys) {
			let total = _number(iKmBefore);
			const oModel = this.getOwnerComponent().getModel();
			(aKeys || []).forEach(sKey => {
				const sPath = "/" + sKey;                   
				total += _number(oModel.getProperty(sPath + "/Distance"));
			});

			return total;
		},

        /**
         * Display address name if cached, else fall back to ID
         */
        addrName: function (iId) {
            const oCache = sap.ui.getCore().getModel("addrCache");
            if (oCache) {
            const oEntry = oCache.getProperty("/map/" + iId);
            if (oEntry && oEntry.Name) {
                return oEntry.Name;
            }
            }
            return iId; // fallback
        },
        
    };
});