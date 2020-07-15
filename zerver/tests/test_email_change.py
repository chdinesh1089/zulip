import datetime

from django.core import mail
from django.http import HttpResponse
from django.urls import reverse
from django.utils.timezone import now

from confirmation.models import Confirmation, confirmation_url, generate_key
from zerver.lib.actions import do_set_realm_property, do_start_email_change_process
from zerver.lib.initial_password import initial_password
from zerver.lib.test_classes import EmailChangeTestMixin, ZulipTestCase
from zerver.models import EmailChangeStatus, UserProfile


class EmailChangeTestCase(ZulipTestCase):
    def test_confirm_email_change_with_non_existent_key(self) -> None:
        self.login('hamlet')
        key = generate_key()
        url = confirmation_url(key, None, Confirmation.EMAIL_CHANGE)
        response = self.client_get(url)
        self.assert_in_success_response(["Whoops. We couldn't find your confirmation link in the system."], response)

    def test_confirm_email_change_with_invalid_key(self) -> None:
        self.login('hamlet')
        key = 'invalid_key'
        url = confirmation_url(key, None, Confirmation.EMAIL_CHANGE)
        response = self.client_get(url)
        self.assert_in_success_response(["Whoops. The confirmation link is malformed."], response)

    def test_confirm_email_change_when_time_exceeded(self) -> None:
        user_profile = self.example_user('hamlet')
        old_email = user_profile.email
        new_email = 'hamlet-new@zulip.com'
        self.login('hamlet')
        obj = EmailChangeStatus.objects.create(new_email=new_email,
                                               old_email=old_email,
                                               user_profile=user_profile,
                                               realm=user_profile.realm)
        key = generate_key()
        date_sent = now() - datetime.timedelta(days=2)
        Confirmation.objects.create(content_object=obj,
                                    date_sent=date_sent,
                                    confirmation_key=key,
                                    type=Confirmation.EMAIL_CHANGE)
        url = confirmation_url(key, user_profile.realm, Confirmation.EMAIL_CHANGE)
        response = self.client_get(url)
        self.assert_in_success_response(["The confirmation link has expired or been deactivated."], response)

    def test_start_email_change_process(self) -> None:
        user_profile = self.example_user('hamlet')
        do_start_email_change_process(user_profile, 'hamlet-new@zulip.com')
        self.assertEqual(EmailChangeStatus.objects.count(), 1)

    def test_email_sent_and_login_page_renders_on_clicking_link(self) -> None:
        data = {'email': 'hamlet-new@zulip.com'}
        self.login('hamlet')
        url = '/json/settings'
        self.assertEqual(len(mail.outbox), 0)
        result = self.client_patch(url, data)
        self.assertEqual(len(mail.outbox), 1)
        self.assert_in_success_response(['Check your email for a confirmation link.'], result)
        email_message = mail.outbox[0]
        self.assertEqual(
            email_message.subject,
            'Verify your new email address',
        )
        body = email_message.body
        self.assertIn('We received a request to change the email', body)
        self.assertRegex(
            email_message.from_email,
            fr"^Zulip Account Security <{self.TOKENIZED_NOREPLY_REGEX}>\Z",
        )

        self.assertEqual(email_message.extra_headers["List-Id"], "Zulip Dev <zulip.testserver>")

        activation_url = [s for s in body.split('\n') if s][2]
        response = self.client_get(activation_url)
        key = activation_url.split("/")[-1]

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f"{reverse('django.contrib.auth.views.login')}?action_key={key}")

        response = self.client_get(response.url)
        self.assert_in_success_response(["Log in to confirm email change"],
                                        response)

    def test_unauthorized_email_change(self) -> None:
        data = {'email': 'hamlet-new@zulip.com'}
        user_profile = self.example_user('hamlet')
        self.login_user(user_profile)
        do_set_realm_property(user_profile.realm, 'email_changes_disabled', True)
        url = '/json/settings'
        result = self.client_patch(url, data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(result.status_code, 400)
        self.assert_in_response("Email address changes are disabled in this organization.",
                                result)
        # Realm admins can change their email address even setting is disabled.
        data = {'email': 'iago-new@zulip.com'}
        self.login('iago')
        url = '/json/settings'
        result = self.client_patch(url, data)
        self.assert_in_success_response(['Check your email for a confirmation link.'], result)

    def test_email_change_already_taken(self) -> None:
        data = {'email': 'cordelia@zulip.com'}
        user_profile = self.example_user('hamlet')
        self.login_user(user_profile)

        url = '/json/settings'
        result = self.client_patch(url, data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(result.status_code, 400)
        self.assert_in_response("Already has an account",
                                result)

    def test_post_invalid_email(self) -> None:
        data = {'email': 'hamlet-new'}
        self.login('hamlet')
        url = '/json/settings'
        result = self.client_patch(url, data)
        self.assert_in_response('Invalid address', result)

    def test_post_same_email(self) -> None:
        data = {'email': self.example_email("hamlet")}
        self.login('hamlet')
        url = '/json/settings'
        result = self.client_patch(url, data)
        self.assertEqual('success', result.json()['result'])
        self.assertEqual('', result.json()['msg'])

class EmailChangePasswordAuthTest(EmailChangeTestMixin, ZulipTestCase):
    __unittest_skip__ = False

    def do_email_change(self, user_profile: UserProfile, action_key: str,
                        different_account: bool=False) -> HttpResponse:
        if different_account:
            user_profile = self.example_user('cordelia')

        password = initial_password(user_profile.delivery_email)
        result = self.client_post(reverse('django.contrib.auth.views.login'),
                                  {'username': user_profile.delivery_email,
                                   'password': password, 'action_key': action_key})

        return result

    def test_email_change_login_attempt_fails(self) -> None:
        user_profile = self.example_user('hamlet')
        new_email = 'hamlet-new@zulip.com'

        action_key = self.create_email_change_confirmation_key(user_profile, new_email)

        result = self.client_post(reverse('django.contrib.auth.views.login'),
                                  {'username': 'random@email.com',
                                   'password': 'randomPassword', 'action_key': action_key})

        self.assert_in_success_response(['Log in to confirm email change'], result)

    def test_social_auth_email_change_unregistered_user_login(self) -> None:
        # Irrelevant for this test class and above test is similar.
        pass
