from typing import List, Optional

from django.http import HttpRequest, HttpResponse
from django.utils.translation import ugettext as _

from zerver.decorator import REQ, has_request_variables
from zerver.lib.actions import check_send_stream_typing_notification, check_send_typing_notification
from zerver.lib.response import json_error, json_success
from zerver.lib.validator import check_int, check_list
from zerver.models import UserProfile


@has_request_variables
def send_notification_backend(
        request: HttpRequest,
        user_profile: UserProfile,
        operator: str=REQ('op'),
        notification_to: Optional[List[int]]=REQ('to', validator=check_list(check_int), default=None),
        to_stream: Optional[int]=REQ('stream_id', validator=check_int, default=None),
        to_topic: Optional[str]=REQ('topic', default=None)) -> HttpResponse:

    if not any([notification_to, to_stream, to_topic]):
        return json_error(_("Insufficient arguments. Should have 'to' or both 'stream_id' and 'topic'."))

    if all([notification_to, to_stream, to_topic]):
        return json_error(_("All 'to', 'stream_id', and  'topic' at once are not accepted"))

    if notification_to and not (to_stream or to_topic):
        check_send_typing_notification(user_profile, notification_to, operator)
    elif to_stream and to_topic:
        check_send_stream_typing_notification(user_profile, operator, to_stream, to_topic)
    else:
        return json_error(_("Bad arguments. Should have 'to' or both 'stream_id' and 'topic'."))

    return json_success()
