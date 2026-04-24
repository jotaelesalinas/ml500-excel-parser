try {
    window.jasmine = jasmineRequire.core(jasmineRequire);
    jasmineRequire.html(window.jasmine);

    const env = window.jasmine.getEnv();
    const jasmineInterface = jasmineRequire.interface(window.jasmine, env);
    Object.assign(window, jasmineInterface);

    const queryString = new window.jasmine.QueryString({
        getWindowLocation: () => window.location,
    });

    const htmlReporter = new window.jasmine.HtmlReporter({
        env,
        queryString,
        onRaiseExceptionsClick: () => queryString.setParam("catch", !env.catchingExceptions()),
        getContainer: () => document.body,
        createElement: (...args) => document.createElement(...args),
        createTextNode: (...args) => document.createTextNode(...args),
        timer: new window.jasmine.Timer(),
    });

    env.configure({
        random: false,
        failFast: false,
    });

    env.addReporter(jasmineInterface.jsApiReporter);
    env.addReporter(htmlReporter);

    const specFilter = new window.jasmine.HtmlSpecFilter({
        filterString: () => queryString.getParam("spec"),
    });

    env.specFilter = spec => specFilter.matches(spec.getFullName());

    window.setTimeout = window.setTimeout;
    window.setInterval = window.setInterval;
    window.clearTimeout = window.clearTimeout;
    window.clearInterval = window.clearInterval;

    await import("./specs/BulkFormInputParser.spec.js");
    await import("./specs/SpreadsheetInputParser.spec.js");
    await import("./specs/FinancialMetrics.spec.js");
    await import("./specs/PortfolioCalculator.spec.js");
    await import("./specs/GoogleSheetsService.spec.js");
    await import("./specs/ResultsTableRenderer.spec.js");
    await import("./specs/InputForm.spec.js");
    await import("./specs/StatusView.spec.js");
    await import("./specs/AppController.spec.js");
    await import("./specs/Main.spec.js");

    htmlReporter.initialize();
    env.execute();
} catch (error) {
    const pre = document.createElement("pre");
    pre.textContent = `Failed to load Jasmine tests:\n${error.stack || error.message}`;
    document.body.appendChild(pre);
    console.error(error);
}
