sap.ui.define([], function () {
    "use strict";

    /**
     * Helper function to safely convert values to numbers
     * @param {*} x - Value to convert
     * @returns {number} Converted number or 0 if conversion fails
     */
    function _number(x) { 
        return Number(x) || 0; 
    }

    return {
        /**
         * Formats the status code to a semantic color state
         * Maps status codes to appropriate UI5 ValueState for visual feedback
         * @param {string} sStatus - The status code from the backend (e.g., 'N', 'A', 'R')
         * @returns {sap.ui.core.ValueState} The corresponding ValueState for UI styling
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
         * Formats status code to human-readable text
         * This is a placeholder implementation that will later be improved
         * to read from the ZbnhStatusSet model for dynamic status text
         * @param {string} sStatus - The status code from the backend
         * @returns {string} The human-readable status text
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

        /**
         * Formats the count of items in a navigation property
         * Used to display the number of trip items in a trip header
         * @param {Array} oNavProperty - Navigation property containing items
         * @returns {number} The number of items
         */
        formatItemCount: function (oNavProperty) {
            return oNavProperty.length; 
        },

        /**
         * Calculates the total kilometers for the month's trips
         * Adds the starting kilometers to the sum of all trip item distances
         * @param {number} iKmBefore - Starting kilometers before the month
         * @param {Array} aKeys - Array of trip item keys to sum distances
         * @returns {number} Total kilometers after the month
         */
        formatKmAfter: function(iKmBefore, aKeys) {
            let total = _number(iKmBefore);
            const oModel = this.getOwnerComponent().getModel();
            
            // Sum up distances from all trip items
            (aKeys || []).forEach(sKey => {
                const sPath = "/" + sKey;                   
                total += _number(oModel.getProperty(sPath + "/Distance"));
            });

            return total;
        },

        /**
         * Displays address name if cached, otherwise falls back to ID
         * Uses a shared address cache for performance optimization
         * @param {number} iId - Address ID to look up
         * @returns {string} Address name if available, otherwise the ID
         */
        addrName: function (iId) {
            const oCache = sap.ui.getCore().getModel("addrCache");
            if (oCache) {
                const oEntry = oCache.getProperty("/map/" + iId);
                if (oEntry && oEntry.Name) {
                    return oEntry.Name;
                }
            }
            return iId; // Fallback to ID if name not found
        }
    };
});