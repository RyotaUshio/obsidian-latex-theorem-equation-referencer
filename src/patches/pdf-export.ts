import { isPdfExport } from 'utils/obsidian';
import { around } from 'monkey-around';
import MathBooster from "main";
import { Modal } from "obsidian";

export const patchPdfExportModal = (plugin: MathBooster) => {
    plugin.register(around(Modal.prototype, {
        open(old) {
            return function () {
                if (!plugin.isPdfPatched) {
                    const isPdfExportModal = Object.hasOwn(this.constructor.prototype, 'printToPdf');

                    if (isPdfExportModal) {
                        plugin.register(
                            around(this.constructor.prototype, {
                                printToPdf(old) {
                                    return function (config: any) {
                                        old.call(this, config);
                                    }
                                }
                            })
                        );
                        plugin.isPdfPatched = true;
                    }
                }

                old.call(this);
            }
        }
    }))
}
