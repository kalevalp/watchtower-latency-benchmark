const log_scraper = require('cloudwatch-log-scraper');

const scraper = new log_scraper.LogScraper('eu-west-2');

async function main() {
    const lgs = await scraper.getAllLogGroups();
    const monitorLog = lgs.find(item => item.match(/watchtower-monitor/));
    const monitorLogElements = await scraper.getAllLogItemsForGroup(monitorLog);

    //console.log(monitorLogElements);
    
    const violationLog = monitorLogElements.filter(x => x.message.match(/Property .* was violated/));

    const violationRE = /Property dummy was violated for property instance \{"dummy":"([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"\}. Failure triggered by event produced by Lambda invocation ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}). Kinesis arrival timestamp @@([0-9]{10}\.[0-9]{0,3})@@.\n/
    const monitorInvocationRE = /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\tProperty dummy/
    const invocationRE = /START RequestId: ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) Version: \$LATEST\n/;

    
    const violationTimes = {}
    
    for (violation of violationLog) {
	const matched = violation.message.match(violationRE);
	violationTimes[matched[1]] = {}
	violationTimes[matched[1]].detected = violation.timestamp;
	violationTimes[matched[1]].violatingInvocation = matched[2];
	violationTimes[matched[1]].kinesisIngectionTime = matched[3];

	const monitorInvocationID = violation.message.match(monitorInvocationRE)[1];
	const monitorInvocationLogElements = monitorLogElements.filter(x => x.message.match(invocationRE)).filter(x => x.message.match(monitorInvocationID));

	if (monitorInvocationLogElements.length === 1) {
	    violationTimes[matched[1]].monitorInvoked = monitorInvocationLogElements[0].timestamp;
	} else if (monitorInvocationLogElements.length > 1) {
	    throw `Expected only a single monitor invocation to match, got ${monitorInvocationLogElements.length}!`;
	    
	}

    }
    
    const ingestionLog = lgs.find(item => item.match(/watchtower-ingestion/));
    const ingestionLogElements = await scraper.getAllLogItemsForGroup(ingestionLog);

    const ingestionFunctionInvocations = ingestionLogElements.filter(elem => elem.message.match(invocationRE));
    
    for (ingestionInvocation of ingestionFunctionInvocations) {
	const ingestionInvocationUuid = ingestionInvocation.message.match(invocationRE)[1];
	const ingestionInvocationTime = ingestionInvocation.timestamp;

	const ingestionInvocationElements = ingestionLogElements.filter(x => x.message.match(ingestionInvocationUuid));

	for (violatingEventUuid in violationTimes) {
	    const violatingEventIngestionLogItems = ingestionInvocationElements.filter(x => x.message.match(violatingEventUuid));

	    if (violatingEventIngestionLogItems.length === 1) {
		const violatingEventIngestionLogItem = violatingEventIngestionLogItems[0];	
		violationTimes[violatingEventUuid].violationTime = violatingEventIngestionLogItem.message.match(/timestamp: ([0-9]{13})/)[1];
		violationTimes[violatingEventUuid].ingestionInvocationTime = ingestionInvocationTime;
	    } else if (violatingEventIngestionLogItems > 1) {
		throw "Expected only a single violating event!"
	    }
	}
    }

    const lambdaLog = lgs.find(item => item.match(/hello/));
    const lambdaLogElements = await scraper.getAllLogItemsForGroup(lambdaLog);

    for (violatingEventUuid in violationTimes) {
	const lambdaLogViolations = lambdaLogElements.filter(x => x.message.match(violatingEventUuid));
	if (lambdaLogViolations.length === 1) {
	    violationTimes[violatingEventUuid].originalViolationCloudWatchIngestionTime = lambdaLogViolations[0].ingestionTime
	} else if (lambdaLogViolations > 1) {
	    throw "Expected only a single violating event in original lambda log!"
	}

    }

    for (violatingEventUuid in violationTimes) {
	violationTimes[violatingEventUuid].kinesisIngectionTime = Number(violationTimes[violatingEventUuid].kinesisIngectionTime) * 1000;
	violationTimes[violatingEventUuid].violationTime        = Number(violationTimes[violatingEventUuid].violationTime);
    }

    for (violatingEventUuid in violationTimes) {
	const report = violationTimes[violatingEventUuid];
	console.log(`
Profiler report for violating event ${violatingEventUuid}:
  Total detection delay: ${report.detected - report.violationTime}(ms).
  Of which:
    CloudWatch Log ingestion delay is: ${report.originalViolationCloudWatchIngestionTime - report.violationTime}(ms),
    Log listener invocation delay is:  ${report.ingestionInvocationTime - report.originalViolationCloudWatchIngestionTime}(ms),
    Kinesis ingestion delay is:        ${report.kinesisIngectionTime - report.ingestionInvocationTime}(ms),
    Monitor invocation delay is:       ${report.monitorInvoked - report.kinesisIngectionTime}(ms),
    Monitor runtime is:                ${report.detected - report.monitorInvoked}(ms)
`);
    }
    
    
    
    
    console.log(violationTimes);


    
    
    
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
