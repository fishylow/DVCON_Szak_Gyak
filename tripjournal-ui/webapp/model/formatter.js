sap.ui.define([], function () {
    "use strict";

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
         * You will need to get the status texts from the backend, this is a placeholder.
         * We will later improve this to read from the ZbnhStatusSet model.
         * @param {string} sStatus The status code from the backend
         * @returns {string} The status text
         */
        formatStatusText: function (sStatus) {
             // For now, a simple mapping. We'll improve this later.
            switch (sStatus) {
                case 'A':
                    return "Approved";
                case 'R':
                    return "Rejected";
                case 'N':
                    return "New";
                default:
                    return sStatus;
            }
        },

        /**
         * Counts the number of items in the expanded navigation property.
         * @param {object} oNavProperty The navigation property object from the binding
         * @returns {number} The number of items
         */
        formatItemCount: function (oNavProperty) {
            if (oNavProperty && oNavProperty.results) {
                return oNavProperty.results.length;
            }
            return 0;
        }
    };
});