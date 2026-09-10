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
    function getModelAndBundle(oContext, that) {
        let model = null;
        let bundle = null;

        // 1. Try from context if passed by Fiori Elements
        if (oContext && typeof oContext.getModel === "function") {
            model = oContext.getModel();
        }

        // 2. Try from `this` (controller / view / extensionAPI)
        if (!model && that) {
            if (typeof that.getModel === "function") {
                model = that.getModel();
            } else if (typeof that.getView === "function" && that.getView()) {
                model = that.getView().getModel();
            }
        }

        // 3. Try from Component registry (standard in Fiori Launchpad & SAP Build Work Zone)
        if (sap.ui.core && sap.ui.core.Component && sap.ui.core.Component.registry) {
            const allComps = Object.values(sap.ui.core.Component.registry.all());
            const component = allComps.find(function (c) {
                try {
                    return (c.getManifestEntry && c.getManifestEntry("/sap.app/id") === "nub.gatepass.adminplants") ||
                           (c.getMetadata && c.getMetadata().getName && c.getMetadata().getName().indexOf("adminplants") !== -1);
                } catch (e) { return false; }
            }) || allComps[0];

            if (component) {
                if (!model && typeof component.getModel === "function") model = component.getModel();
                const i18n = typeof component.getModel === "function" ? component.getModel("i18n") : null;
                if (i18n && i18n.getResourceBundle) bundle = i18n.getResourceBundle();
            }
        }

        // 4. Try from ComponentContainer (standalone index.html)
        if (!model || !bundle) {
            const core = sap.ui.getCore();
            const container = core.byId("container");
            const comp = container && container.getComponentInstance ? container.getComponentInstance() : null;
            if (comp) {
                if (!model && typeof comp.getModel === "function") model = comp.getModel();
                if (!bundle && typeof comp.getModel === "function") {
                    const i18n = comp.getModel("i18n");
                    if (i18n && i18n.getResourceBundle) bundle = i18n.getResourceBundle();
                }
            }
        }

        // 5. Fallback: Scan all active controls in Core for any control holding the OData V4 model
        if (!model || !bundle) {
            const core = sap.ui.getCore();
            const elements = core.mElements || (core.getElements ? core.getElements() : {});
            for (const id in elements) {
                const el = elements[id];
                if (el && typeof el.getModel === "function") {
                    if (!model) {
                        const m = el.getModel();
                        if (m && typeof m.bindContext === "function") {
                            model = m;
                        }
                    }
                    if (!bundle) {
                        const i18n = el.getModel("i18n");
                        if (i18n && typeof i18n.getResourceBundle === "function") {
                            bundle = i18n.getResourceBundle();
                        }
                    }
                    if (model && bundle) break;
                }
            }
        }

        return { model, bundle };
    }

    return {
        onRunDayEndJob: function (oContext) {
            const { model, bundle } = getModelAndBundle(oContext, this);
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
