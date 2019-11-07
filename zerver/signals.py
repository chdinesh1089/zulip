from typing import Any, Optional

from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.utils.timezone import \
    get_current_timezone_name as timezone_get_current_timezone_name
from django.utils.timezone import now as timezone_now
from django.utils.translation import ugettext as _

from confirmation.models import one_click_unsubscribe_link
from zerver.lib.queue import queue_json_publish
from zerver.lib.send_email import FromAddress
from zerver.models import UserProfile
from zerver.lib.timezone import get_timezone
from ua_parser import user_agent_parser

JUST_CREATED_THRESHOLD = 60

def get_device_browser(user_agent: str) -> Optional[str]:
    device_browser = user_agent_parser.ParseUserAgent(user_agent)['family']
    if "zulip" in user_agent.lower():
        return "Zulip"
    elif device_browser == "IE":
        return "Internet Explorer"
    elif device_browser == "Chrome Mobile iOS":
        return "Chrome Mobile"
    elif device_browser != "Other":
        return device_browser
    else:
        return None


def get_device_os(user_agent: str) -> Optional[str]:
    device_os = user_agent_parser.ParseOS(user_agent)['family']
    user_agent = user_agent.lower()
    if device_os != "Other":
        return device_os
    else:
        return None

@receiver(user_logged_in, dispatch_uid="only_on_login")
def email_on_new_login(sender: Any, user: UserProfile, request: Any, **kwargs: Any) -> None:
    if not user.enable_login_emails:
        return
    # We import here to minimize the dependencies of this module,
    # since it runs as part of `manage.py` initialization
    from zerver.context_processors import common_context

    if not settings.SEND_LOGIN_EMAILS:
        return

    if request:
        # If the user's account was just created, avoid sending an email.
        if (timezone_now() - user.date_joined).total_seconds() <= JUST_CREATED_THRESHOLD:
            return

        user_agent = request.META.get('HTTP_USER_AGENT', "")

        context = common_context(user)
        context['user_email'] = user.delivery_email
        user_tz = user.timezone
        if user_tz == '':
            user_tz = timezone_get_current_timezone_name()
        local_time = timezone_now().astimezone(get_timezone(user_tz))
        if user.twenty_four_hour_time:
            hhmm_string = local_time.strftime('%H:%M')
        else:
            hhmm_string = local_time.strftime('%I:%M%p')
        context['login_time'] = local_time.strftime('%A, %B %d, %Y at {} %Z'.format(hhmm_string))
        context['device_ip'] = request.META.get('REMOTE_ADDR') or _("Unknown IP address")
        context['device_os'] = get_device_os(user_agent) or _("an unknown operating system")
        context['device_browser'] = get_device_browser(user_agent) or _("An unknown browser")
        context['unsubscribe_link'] = one_click_unsubscribe_link(user, 'login')

        email_dict = {
            'template_prefix': 'zerver/emails/notify_new_login',
            'to_user_ids': [user.id],
            'from_name': FromAddress.security_email_from_name(user_profile=user),
            'from_address': FromAddress.NOREPLY,
            'context': context}
        queue_json_publish("email_senders", email_dict)
