/**
 * Utility function to get the current user ID
 * Retrieves user information from SAP Fiori launchpad or falls back to default
 * 
 * @function
 * @name getCurrentUser
 * @returns {string} Current user ID in uppercase, or "BNEDER" as fallback
 */
function getCurrentUser() {
    return sap.ushell && sap.ushell.Container
         ? sap.ushell.Container.getUser().getId().toUpperCase()
         : "BNEDER";        // fallback for local run
  }
  

/**
 * Formatter module for Trip Journal Application
 * 
 * This module contains utility functions for formatting data displayed in the UI.
 * It provides functions for status formatting, calculations, and data transformations.
 * 
 * @namespace tripjournal.tripjournalui.model
 */
sap.ui.define([], function () {
    "use strict";

    /**
     * Helper function to safely convert values to numbers
     * Handles edge cases and provides fallback to 0 for invalid values
     * 
     * @function
     * @name _number
     * @private
     * @param {*} x - Value to convert to number
     * @returns {number} Converted number or 0 if conversion fails
     */
    function _number(x) { 
        return Number(x) || 0; 
    }

    return {
        /**
         * Formats the status code to a semantic color state
         * Maps status codes to appropriate UI5 ValueState for visual feedback
         * 
         * @function
         * @name formatStatusState
         * @param {string} sStatus - The status code from the backend (e.g., 'N', 'A', 'R')
         * @returns {sap.ui.core.ValueState} The corresponding ValueState for UI styling
         * 
         * @example
         * // Returns "Warning" for new trips
         * formatStatusState('N') // => "Warning"
         * 
         * // Returns "Success" for approved trips
         * formatStatusState('J') // => "Success"
         */
        formatStatusState: function (sStatus) {
            if (!sStatus) {
                return "None";
            }
            
            switch (sStatus) {
                case 'J': // Approved
                    return "Success";
                case 'E': // Rejected
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
         * 
         * @function
         * @name formatStatusText
         * @param {string} sStatus - The status code from the backend
         * @returns {string} The human-readable status text
         * 
         * @example
         * // Returns "Nyitott" for new trips
         * formatStatusText('N') // => "Nyitott"
         * 
         * // Returns "Jóváhagyott" for approved trips
         * formatStatusText('J') // => "Jóváhagyott"
         */
        formatStatusText: function (sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // For now, a simple mapping. Will improve this later.
            switch (sStatus) {
                case 'J':
                    return "Jóváhagyott";
                case 'E':
                    return "Elutasított";
                case 'N':
                    return "Nyitott";
                default:
                    return sStatus;
            }
        },

        /**
         * Formats the count of items in a navigation property
         * Used to display the number of trip items in a trip header
         * 
         * @function
         * @name formatItemCount
         * @param {Array} oNavProperty - Navigation property containing items
         * @returns {number} The number of items
         * 
         * @example
         * // Returns the number of trip items
         * formatItemCount(tripHeader.to_TripItemSet) // => 5
         */
        formatItemCount: function (oNavProperty) {
            if (!oNavProperty || !Array.isArray(oNavProperty)) {
                return 0;
            }
            return oNavProperty.length; 
        },

        /**
         * Calculates the total kilometers for the month's trips
         * Adds the starting kilometers to the sum of all trip item distances
         * 
         * @function
         * @name formatKmAfter
         * @param {number} iKmBefore - Starting kilometers before the month
         * @param {Array} aKeys - Array of trip item keys to sum distances
         * @returns {number} Total kilometers after the month
         * 
         * @example
         * // Calculates total kilometers including trip items
         * formatKmAfter(1000, ['item1', 'item2']) // => 1250 (if items have 150 and 100 km)
         */
        formatKmAfter: function(iKmBefore, aKeys) {
            let total = _number(iKmBefore);
            const oModel = this.getOwnerComponent().getModel();
            
            if (!oModel || !Array.isArray(aKeys)) {
                return total;
            }
            
            // Sum up distances from all trip items
            aKeys.forEach(sKey => {
                if (sKey) {
                    const sPath = "/" + sKey;                   
                    const distance = oModel.getProperty(sPath + "/Distance");
                    total += _number(distance);
                }
            });

            return total;
        },

        /**
         * Displays address name if cached, otherwise falls back to ID
         * Uses a shared address cache for performance optimization
         * 
         * @function
         * @name addrName
         * @param {number} iId - Address ID to look up
         * @returns {string} Address name if available, otherwise the ID
         * 
         * @example
         * // Returns address name if cached, otherwise the ID
         * addrName(123) // => "Budapest, Kossuth tér 1" or "123"
         */
        addrName: function (iId) {
            if (!iId) {
                return "";
            }
            
            const oCache = sap.ui.getCore().getModel("addrCache");
            if (oCache) {
                const oEntry = oCache.getProperty("/map/" + iId);
                if (oEntry && oEntry.Name) {
                    return oEntry.Name;
                }
            }
            return String(iId); // Fallback to ID if name not found
        },

        /**
         * Formats a number with proper decimal places for currency display
         * Ensures consistent formatting across the application
         * 
         * @function
         * @name formatCurrency
         * @param {number} fValue - The numeric value to format
         * @param {number} iDecimals - Number of decimal places (default: 2)
         * @returns {string} Formatted currency string
         * 
         * @example
         * // Formats currency with 2 decimal places
         * formatCurrency(123.456) // => "123.46"
         * formatCurrency(123.456, 3) // => "123.456"
         */
        formatCurrency: function(fValue, iDecimals = 2) {
            const numValue = _number(fValue);
            return numValue.toFixed(iDecimals);
        },

        /**
         * Formats distance values with proper units
         * Ensures consistent distance formatting across the application
         * 
         * @function
         * @name formatDistance
         * @param {number} fValue - The distance value in kilometers
         * @returns {string} Formatted distance string with units
         * 
         * @example
         * // Formats distance with km unit
         * formatDistance(123.5) // => "123.5 km"
         */
        formatDistance: function(fValue) {
            const numValue = _number(fValue);
            return numValue.toFixed(1) + " km";
        },

        /**
         * Formats fuel consumption values with proper units
         * Ensures consistent consumption formatting across the application
         * 
         * @function
         * @name formatConsumption
         * @param {number} fValue - The consumption value in liters per 100km
         * @returns {string} Formatted consumption string with units
         * 
         * @example
         * // Formats fuel consumption
         * formatConsumption(7.5) // => "7.5 l/100km"
         */
        formatConsumption: function(fValue) {
            const numValue = _number(fValue);
            return numValue.toFixed(1) + " l/100km";
        },

        /**
        * Returns a short preview (57 chars + ellipsis) for table display.
        * @param {string} s - full note string (≤300 char)
        * @returns {string} truncated string
        */
        shortNote: function (s) {
            if (!s) { return ""; }
            const MAX = 58;              // 57 + 1 “…” glyph
            return s.length > MAX ? s.slice(0, MAX - 1) + "…" : s;
        }
        
    };
});