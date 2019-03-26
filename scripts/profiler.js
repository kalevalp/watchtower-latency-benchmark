const log_scraper = require('cloudwatch-log-scraper');

const scraper = new log_scraper.LogScraper('eu-west-2');

async function main() {
    const lgs = await scraper.getAllLogGroups();
    const monitorLog = lgs.find(item => item.match(/watchtower-monitor/));
    const monitorLogElements = await scraper.getAllLogItemsForGroup(monitorLog);
    const violationLog = monitorLogElements.filter(x => x.message.match(/Property .* was violated/));

    const violationRE = /Property dummy was violated for property instance \{"dummy":"([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"\}. Failure triggered by event produced by Lambda invocation ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}).\n/

    const violationTimes = {}
    
    for (violation of violationLog) {
	const matched = violation.message.match(violationRE);
	violationTimes[matched[1]] = {}
	violationTimes[matched[1]].detected = violation.timestamp;
	violationTimes[matched[1]].violatingInvocation = matched[2];
	
	// console.log(violationTimes);
    }
    
    const ingestionLog = lgs.find(item => item.match(/watchtower-ingestion/));
    const ingestionLogElements = await scraper.getAllLogItemsForGroup(ingestionLog);

    const ingestionInvocationRE = /START RequestId: ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) Version: \$LATEST\n/;

    const ingestionFunctionInvocations = ingestionLogElements.filter(elem => elem.message.match(ingestionInvocationRE));
    
    for (ingestionInvocation of ingestionFunctionInvocations) {
	const ingestionInvocationUuid = ingestionInvocation.message.match(ingestionInvocationRE)[1];
	const ingestionInvocationTime = ingestionInvocation.timestamp;

	const ingestionInvocationElements = ingestionLogElements.filter(x => x.message.match(ingestionInvocationUuid));

	for (violatingEventUuid in violationTimes) {
	    console.log(ingestionInvocationElements.filter(x => x.message.match(violatingEventUuid)));
	}
	
	
    }
    

    
    
    
    // const createArticleLogGroup = lgs.find(item => item.match(/createArticle/));
    // const articleCreateLog = await scraper.getAllLogItemsForGroup(createArticleLogGroup);
    // const articleCreateEvents = articleCreateLog.filter(x => x.message.match(/EVENTUPDATE/));

    // const violatingInvocationRE = /Failure triggered by event produced by Lambda invocation ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/;

    // for (const violation of violationLog) {       
    //     const violationDetails = violation.message.match(violatingInvocationRE)[1]
        
    //     const violatingEvent = articleCreateEvents.find(x => x.message.match(violationDetails))
    //     console.log(`Time of violating event: ${violatingEvent.timestamp}, time of violation detection: ${violation.timestamp}, delay: ${violation.timestamp-violatingEvent.timestamp}(ms).`);
    // }

    // console.log(articleCreateLog.filter(x => x.message.match(/EVENTUPDATE/)));
}

main();
