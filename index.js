const core = require("@actions/core");
const axios = require("axios");

const {GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_REF} = process.env;
const BASE_URL = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}`;
const PR_NUMBER = GITHUB_REF.match(/^refs\/pull\/(.+)\/merge$/)[1];

const getReviews = async () => {
    const [{data: {assignees}}, {data: reviews}] = await Promise.all([
        axios({
            method: "get",
            url: `${BASE_URL}/pulls/${PR_NUMBER}`,
            headers: {
                Authorization: `token ${core.getInput("token")}`
            }
        }),
        axios({
            method: "get",
            url: `${BASE_URL}/pulls/${PR_NUMBER}/reviews`,
            headers: {
                Authorization: `token ${core.getInput("token")}`
            }
        })
    ]);

    return reviews.filter(({user}) => !assignees.some(assignee => assignee.login === user.login));
};
const getRequestedReviewers = async () => {
    const {data: {users: requestedReviewers}} = await axios({
        method: "get",
        url: `${BASE_URL}/pulls/${PR_NUMBER}/requested_reviewers`,
        headers: {
            Authorization: `token ${core.getInput("token")}`
        }
    });

    return requestedReviewers;
};

const STATE = {
    INIT: Symbol("init"),
    REQUESTED: Symbol("requested"),
    APPROVED: Symbol("approved"),
    CHANGES_REQUESTED: Symbol("changes_requested"),
    COMMENTED: Symbol("commented")
};
const PRIORITY = {
    [STATE.INIT]: -1,
    [STATE.COMMENTED]: 0,
    [STATE.CHANGES_REQUESTED]: 1,
    [STATE.APPROVED]: 1,
    [STATE.REQUESTED]: 2
};

class Reviewer {
    static _instance = {};

    static getReviewers() {
        return Object.values(Reviewer._instance);
    }

    static create({login}) {
        const instance = Reviewer._instance[login];

        if (instance) {
            return instance;
        }

        return (Reviewer._instance[login] = new Reviewer());
    }

    _isAcceptable(state) {
        return PRIORITY[this._state] < PRIORITY[state];
    }

    _state = STATE.INIT;
    _participated = false;

    updateState(state) {
        if (!this._isAcceptable(state)) {
            return;
        }

        this._state = state;
    }

    participate() {
        this._participated = true;
    }

    get participated() {
        return this._participated;
    }

    get approved() {
        return this._state === STATE.APPROVED;
    }

    get changesRequested() {
        return this._state === STATE.CHANGES_REQUESTED;
    }
}

(async () => {
    try {
        const [reviews, requestedReviewers] = await Promise.all([getReviews(), getRequestedReviewers()]);

        requestedReviewers.forEach(reviewer => {
            Reviewer.create(reviewer).updateState(STATE.REQUESTED);
        });

        reviews.reverse().forEach(review => {
            const {user: userData, state} = review;
            const user = Reviewer.create(userData)

            user.updateState(STATE[state]);
            user.participate();
        })

        const reviewers = Reviewer.getReviewers();

        if (reviewers.some(reviewer => reviewer.changesRequested)) {
            core.setFailed("Someone requested changes");

            return;
        }

        if (!reviewers.filter(reviewer => reviewer.participated)
            .every(reviewer => reviewer.approved)) {
            core.setFailed("All participants must approve");

            return;
        }

        const totalCount = reviewers.length;
        const approvedCount = reviewers.filter(reviewer => reviewer.approved).length;
        const MINIMUM_APPROVED_COUNT = 3;

        if (approvedCount >= Math.max(MINIMUM_APPROVED_COUNT, totalCount / 2)) { // todo import condition
            core.notice("It's time to merge!");

            return;
        }

        core.setFailed("Not enough approvals");
    } catch (e) {
        core.setFailed(e.message);
    }
})();
