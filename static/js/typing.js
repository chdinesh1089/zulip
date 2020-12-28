"use strict";

const typing_status = require("../shared/js/typing_status");

const people = require("./people");

// This module handles the outbound side of typing indicators.
// We detect changes in the compose box and notify the server
// when we are typing.  For the inbound side see typing_events.js.
//
// See docs/subsystems/typing-indicators.md for details on typing indicators.

function send_typing_notification_ajax(data) {
    channel.post({
        url: "/json/typing",
        data,
        success() {},
        error(xhr) {
            blueslip.warn("Failed to send typing event: " + xhr.responseText);
        },
    });
}

function send_pm_typing_notification(user_ids_array, operation) {
    const data = {
        to: JSON.stringify(user_ids_array),
        op: operation,
    };
    send_typing_notification_ajax(data);
}

function send_stream_typing_notification(stream_id, topic, operation) {
    const data = {
        stream_id: stream_id,
        topic: topic,
        op: operation,
    };
    send_typing_notification_ajax(data);
}

function send_typing_notification_based_on_msg_type(to, operation) {
    const message_type = compose_state.get_message_type();
    if (Array.isArray(to) && message_type === "private") {
        const user_ids_array = to;
        send_pm_typing_notification(user_ids_array, operation);
    } else if (message_type === "stream") {
        send_stream_typing_notification(to.stream_id, to.topic, operation);
    }
}

function get_user_ids_array() {
    const user_ids_string = compose_pm_pill.get_user_ids_string();
    if (user_ids_string === "") {
        return null;
    }

    return people.user_ids_string_to_ids_array(user_ids_string);
}

function is_valid_conversation() {
    const compose_empty = !compose_state.has_message_content();
    if (compose_empty) {
        return false;
    }

    return true;
}

function get_current_time() {
    return Date.now();
}

function notify_server_start(to) {
    send_typing_notification_based_on_msg_type(to, "start");
}

function notify_server_stop(to) {
    send_typing_notification_based_on_msg_type(to, "stop");
}

exports.get_recipient = function () {
    const message_type = compose_state.get_message_type();
    if (message_type === "private") {
        return get_user_ids_array();
    }
    if (message_type === "stream") {
        const stream_name = compose_state.stream_name();
        const stream_id = stream_data.get_stream_id(stream_name);
        const topic = compose_state.topic();
        return {stream_id, topic};
    }
    return null;
};

exports.initialize = function () {
    const worker = {
        get_current_time,
        notify_server_start,
        notify_server_stop,
    };

    $(document).on("input", "#compose-textarea", () => {
        // If our previous state was no typing notification, send a
        // start-typing notice immediately.
        const new_recipient = is_valid_conversation() ? exports.get_recipient() : null;
        typing_status.update(worker, new_recipient);
    });

    // We send a stop-typing notification immediately when compose is
    // closed/cancelled
    $(document).on("compose_canceled.zulip compose_finished.zulip", () => {
        typing_status.update(worker, null);
    });
};

window.typing = exports;
