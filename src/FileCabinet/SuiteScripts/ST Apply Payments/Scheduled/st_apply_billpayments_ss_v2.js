/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],

    function (record, search) {


        const ACCOUNT_ID_UK_USD = '1430';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_UK_EUR = '1429';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_UK_GBP = '1428';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_US = '1431';  //Bank for closing old transactions bank account for processing
        const ACCOUNT_ID_CA = '1432';  //Bank for closing old transactions bank account for processing


        function execute(context) {

            var transCount = 0;
            // Create a JavaScript Date object for April 1, 2023
            var tranDate = new Date(2023, 3, 1); // Note: Months are zero-based, so 3 represents April

            // Load search
            var invoiceSearchObj = search.load({
                id: "customsearch_st_apply_open_bills"
            });

            var searchResultCount = invoiceSearchObj.runPaged().count;
            log.debug("invoiceSearchObj result count", searchResultCount);

            if (searchResultCount == 0) {
                log.audit('No transactions to process searchResultCount :' + searchResultCount);
                return;
            }

            // Run search of invoices
            invoiceSearchObj.run().each.promise(function (result) {
                try {
                    var columns = result.columns;

                    var invoiceId = result.getValue(columns[0]); // Invoice ID
                    var invoiceCur = result.getValue(columns[1]); // Invoice Currency

                    log.debug('Processing Invoice ID: ' + invoiceId);

                    var billPayment = record.transform({
                        fromType: record.Type.VENDOR_BILL,
                        fromId: invoiceId,
                        toType: record.Type.VENDOR_PAYMENT,
                        isDynamic: true,
                    });


                    //set bank account based on subsidiary
                    var subsidiaryID = billPayment.getValue('subsidiary')
                    log.debug('subsidiaryID : '+subsidiaryID)


                    if(subsidiaryID == 6){ //Nexsan UK
                        var transCurrency = billPayment.getText('currency')
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
                    billPayment.setValue('currency', invoiceCur);
                    billPayment.setValue('account', account_id);
                    billPayment.setValue('trandate', tranDate);
                    billPayment.setValue('memo', 'Autogenerate payment to close old invoices');

                    var lineCount = billPayment.getLineCount({
                        sublistId: 'apply'
                    });

                    log.debug('lineCount: ', lineCount);

                    if (lineCount == 0) {
                        log.audit('Transaction skipped lineCount :' + lineCount + ' record ' + invoiceId);
                    } else {
                        // Loop through the apply sublist and set "apply" checkbox to true for each line
                        for (var i = 0; i < lineCount; i++) {
                            billPayment.selectLine({
                                sublistId: 'apply',
                                line: i
                            });
                            billPayment.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                value: true
                            });
                            billPayment.commitLine({
                                sublistId: 'apply'
                            });
                        }

                       log.debug('billPayment before Save' + cpId, JSON.stringify(billPayment));

                        var cpId = billPayment.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });

                        transCount += 1;

                        log.audit(transCount + 'traansactions processed. Created Vendor Payment ID: ' + cpId + ' for Invoice: ' + invoiceId);
                    }
                } catch (ex) {
                    log.error('Error processing invoice ' + invoiceId + ': ', ex);
                }

                return true;
            }).catch(function (error) {
                log.error('Error processing bills :', error);
            });
        }

        return {
            execute: execute
        };

    });
