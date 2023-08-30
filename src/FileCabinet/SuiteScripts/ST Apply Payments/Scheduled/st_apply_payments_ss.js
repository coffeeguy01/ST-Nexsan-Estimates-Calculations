/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime'],

    function (record, search, runtime) {

        const ACCOUNT_ID_UK_USD = '1430';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_UK_EUR = '1429';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_UK_GBP = '1428';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_US = '1431';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_CA = '1432';  //Bank for closing old transactions bank account for processing



        function execute(context) {

            var transCount = 0
            var scriptObj = runtime.getCurrentScript();
            // Create a JavaScript Date object for April 1, 2023
            var tranDate = new Date(2023, 3, 1); // Note: Months are zero-based, so 3 represents April




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



                //Set Bank Account by Subsidiary
                var subsidiaryID    = customerPayment.getValue('subsidiary')
                log.debug('subsidiaryID : '+subsidiaryID+ ' tranDate '+tranDate )

                if(subsidiaryID == 6){ //Nexsan UK
                    var transCurrency = customerPayment.getText('currency')
                    log.debug('transCurrency : '+transCurrency)
                    if(transCurrency == 'EUR'){
                        account_id = ACCOUNT_ID_UK_EUR
                    } else if (transCurrency == 'USD'){
                        account_id = ACCOUNT_ID_UK_USD
                    } else if (transCurrency == 'GBP'){
                        account_id = ACCOUNT_ID_UK_GBP
                    }

                } else if (subsidiaryID == 7) { //Nexsan USA

                    account_id = ACCOUNT_ID_US
                } else if (subsidiaryID == 5) { //Nexsan CA
                    account_id = ACCOUNT_ID_CA
                }

                // Set header values
                customerPayment.setValue('account', account_id);
                customerPayment.setValue('trandate', tranDate);
                customerPayment.setValue('memo', 'Autogenerate payment to close old invoices');

                var lineCount = customerPayment.getLineCount({
                    sublistId: 'apply'
                }); // In the UI, this can be seen under the APPLY subtab > Invoices Sublist when creating a new CUSTOMER PAYMENT record.

                log.debug('lineCount: ', lineCount);

                try {
                    var cpId = customerPayment.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                    transCount += 1


                    log.audit(transCount + ' Created Customer Payment ID: ' + cpId + ' for Invoice: ' + invoiceId);

                    var remainingUsage = scriptObj.getRemainingUsage()
                    log.debug('Remaining governance units: ' + remainingUsage);


                }catch (e) {
                    log.audit('Catch error invoiceId : '+invoiceId)

                }
                return true;
            }).catch(function (error) {
                log.error('Error processing invoices:', error.message);
            });

        }

        return {
            execute: execute
        };

    });

