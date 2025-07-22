/*global QUnit*/

sap.ui.define([
	"tripjournal/tripjournalui/controller/TripJournal.controller"
], function (Controller) {
	"use strict";

	QUnit.module("TripJournal Controller");

	QUnit.test("I should test the TripJournal controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
