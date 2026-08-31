sap.ui.define(["sap/m/MessageBox"], function (MessageBox) {
    "use strict";

    // Section 3: "Administrator ... runs the day-end job."  There is no
    // annotation-driven way to trigger an UNBOUND action from a Fiori
    // Elements List Report toolbar — bound actions get a DataFieldForAction,
    // but this one isn't bound to any entity.  This plain module, referenced
    // by dotted path from manifest.json's content.header.actions, is the
    // supported way sap.fe extends a generated List Report for exactly
    // this case; everything else in this app is still fully annotation-driven.
    //
    // sap.fe calls a header action's "press" module with the selected-rows
    // array only — no view/model reference — so the OData model is fetched
    // through the one Component this single-purpose app ever mounts, via
    // the ComponentContainer's DOM id set in index.html.
    function getModelAndBundle() {
        const container = sap.ui.getCore().byId("container");
        const component = container && container.getComponentInstance ? container.getComponentInstance() : null;
        const model = component ? component.getModel() : null;
        const i18nModel = component ? component.getModel("i18n") : null;
        const bundle = i18nModel ? i18nModel.getResourceBundle() : null;
        return { model, bundle };
    }

    return {
        onRunDayEndJob: function () {
            const { model, bundle } = getModelAndBundle();
            const text = (key, args) => (bundle ? bundle.getText(key, args) : key);

            if (!model) {
                MessageBox.error("Could not reach the OData model to run the day-end job.");
                return;
            }

            MessageBox.confirm(text("ConfirmDayEndJob"), {
                title: text("RunDayEndJob"),
                onClose: (action) => {
                    if (action !== MessageBox.Action.OK) return;

                    const operation = model.bindContext("/runDayEndJob(...)");
                    operation.execute()
                        .then(() => {
                            const result = operation.getBoundContext().getObject();
                            MessageBox.success(
                                text("DayEndJobResult", [result.expired, result.overstay]),
                                { title: text("RunDayEndJob") }
                            );
                        })
                        .catch((error) => {
                            MessageBox.error(
                                text("DayEndJobFailed", [error && error.message || String(error)]),
                                { title: text("RunDayEndJob") }
                            );
                        });
                }
            });
        }
    };
});
