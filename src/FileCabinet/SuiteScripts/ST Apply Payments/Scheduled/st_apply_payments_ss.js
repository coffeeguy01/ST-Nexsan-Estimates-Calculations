/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],

    function (record, search) {

        const ACCOUNT_ID = '1413';  //Bank for closing old transactions bank account for processing

        function execute(context) {

            var transCount = 0

            // Load search
            var invoiceSearchObj = search.load({
                id: "customsearch_st_apply_open_invoices"
            });

            var searchResultCount = invoiceSearchObj.runPaged().count;
            log.debug("invoiceSearchObj result count", searchResultCount);
            if (searchResultCount == 0){
                log.audit('No transactions to process searchResultCount :' +searchResultCount)
                return
            }
            // Run search of invoices
            invoiceSearchObj.run().each.promise(function (result) {
                var columns = result.columns;

                var invoiceId = result.getValue(columns[0]); // Invoice ID

                log.debug('Processing Invoice ID: ' + invoiceId);

                var customerPayment = record.transform({
                    fromType: record.Type.INVOICE,
                    fromId: invoiceId,
                    toType: record.Type.CUSTOMER_PAYMENT,
                    isDynamic: true,
                });

                // Set header values
                customerPayment.setValue('account', ACCOUNT_ID);
                customerPayment.setValue('memo', 'Autogenerate payment to close old invoices');

                var lineCount = customerPayment.getLineCount({
                    sublistId: 'apply'
                }); // In the UI, this can be seen under the APPLY subtab > Invoices Sublist when creating a new CUSTOMER PAYMENT record.

                log.debug('lineCount: ', lineCount);

                var cpId = customerPayment.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                transCount += 1


                log.audit(transCount+ ' Created Customer Payment ID: ' + cpId + ' for Invoice: ' + invoiceId);

                return true;
            }).catch(function (error) {
                log.error('Error processing invoices:', error.message);
            });

        }

        return {
            execute: execute
        };

    });

