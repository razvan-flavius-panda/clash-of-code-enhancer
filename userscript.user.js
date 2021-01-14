// ==UserScript==
// @name        Clash of Code Enhancer
// @namespace   Violentmonkey Scripts
// @match       *://www.codingame.com/*
// @grant       none
// @version     1.0
// @author      Răzvan Flavius Panda
// @description CodinGame Clash of Code enhancer: fair rankings, competition, ...
// @require https://raw.githubusercontent.com/lodash/lodash/4.17.15-npm/lodash.js
// ==/UserScript==
// TODO:
// * automatically start sync on new clash + click on start clash button
// * automatic invites and twitch/discord share
// * css for winners
// * improve overall design
// * easy way to view code side-by-side
// * save answers locally
// * competition features:
//     - leaderboard
//     - vote on quality, type safety, etc.
//     - voting via CoC integrated chat
(new MutationObserver(check)).observe(document, { childList: true, subtree: true });
function check(_changes, observer) {
    if (document.querySelector('.player-report')) {
        observer.disconnect();
        var previousFinishedCount = 0;
        update();
        setInterval(update, 3000);
        function update() {
            var $reportContainer = $(".report-container > .content-container");
            var $reports = $reportContainer.children('[ng-repeat]');
            if (_.isEmpty($reports)) {
                location.reload();
            }
            var reports = [];
            $('.player-report').each(function (_i, obj) {
                reports.push({
                    rank: parseInt($(obj).find('.clash-rank').text()),
                    score: parseInt($(obj).find('div.info-clash.score > div > div.info-content-container > div.info-value > span').text()),
                    pending: _.isEmpty($(obj).find('.pending-rank')),
                    nickname: $(obj).find('.nickname').text(),
                    language: $(obj).find('div.info-clash.language > div > div.info-content-container > div.info-value > span').text()
                });
            });
            var finishedCount = _.countBy(reports, function (report) { return !isNaN(report.score); }).true;
            if (previousFinishedCount === finishedCount)
                return;
            previousFinishedCount = finishedCount;
            var isShortestMode = $('div.clash-info-container > div > div.info-clash.criterion > div > div.info-content-container > div.info-label > span').first().text() === 'CHARACTERS';
            var reportsByLanguage = _.groupBy(reports, function (report) { return report.language; });
            _.forOwn(reportsByLanguage, function (reports, language) {
                _.forEach(reports, function (report, idx) { return report.fairRank = language === 'N/A' ? NaN : idx + 1; });
            });
            var fairReports = _.sortBy(_.flatten(_.map(reportsByLanguage, function (reports, _) { return reports; })), function (report) { return report.rank; });
            var worstRank = _.max(_.map(_.filter(fairReports, function (report) { return report.score > 0; }), function (report) { return report.fairRank; }));
            _.forEach(fairReports, function (report) {
                if (report.score === 0) {
                    report.fairRank = worstRank + 1;
                }
            });
            // Leaderboard core input data:
            //   - score = percentage of tests passed, Int, [0..100]
            //   - time = time it took to solve the challenge, Int, [0..MAXtime]
            //   - length = code size in number of characters, Int, [0..MAXlength]
            //   - language = language in which the challenge was solved in
            // Derived inputs:
            //   - rank = position in CoC without this userscript, Int, [1..MAXrank]
            //   - fair rank = position in each group per language, Int, [1..MAXfairRank]
            function getLeaderboardPoints(score, time, length, fairRank) {
                var isShortestMode = !isNaN(length);
                return isShortestMode
                    ? score / (time * fairRank)
                    : score / time;
            }
            $reports.each(function (index, obj) {
                var fairReport = fairReports[index];
                $(obj).find('.clash-rank').text(fairReport.fairRank);
                if ($(obj).attr('class') === 'my-background') {
                    $(obj)
                        .find('div.clash-rank')
                        .css('background-color', 'blueviolet');
                }
                if (fairReport.score > 0) {
                    var bgColor;
                    switch (fairReport.fairRank) {
                        case 1:
                            bgColor = 'mediumseagreen';
                            break;
                        case 2:
                            bgColor = 'yellow';
                            break;
                        default: bgColor = 'orange';
                    }
                }
                else if (isNaN(fairReport.score)) {
                    bgColor = 'transparent';
                }
                else {
                    bgColor = 'indianred';
                }
                $(obj).css('background-color', bgColor);
                $(obj)
                    .find('button')
                    .css('background-color', '#e7e9eb');
            });
            $reportContainer
                .children('.header-result')
                .after(_.sortBy($reports.detach(), function ($report) { return Math.random() + parseInt($($report).find('.clash-rank').text()); }));
        }
    }
}
//# sourceMappingURL=userscript.user.js.map