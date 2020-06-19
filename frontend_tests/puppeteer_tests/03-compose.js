const common = require('../puppeteer_lib/common');
const assert = require("assert").strict;

async function check_compose_form_empty(page) {
    await common.check_form_contents(page,
                                     '#send_message_form',
                                     {
                                         stream_message_recipient_stream: '',
                                         stream_message_recipient_topic: '',
                                         content: '',
                                     }
    );
}

async function close_compose_box(page) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('#compose-textarea', {hidden: true});
}

async function compose_tests(page) {
    await common.log_in(page);
    await page.waitForSelector('#zhome .message_row');
    const initial_msgs_qty = await page.evaluate(() => {
        return $('#zhome .message_row').length;
    });

    console.log(initial_msgs_qty);

    await common.send_multiple_messages(page, [
        { stream: 'Verona',
          topic: 'Reply test',
          content: "We reply to this message",
        },
        { recipient: "cordelia@zulip.com",
          content: "And reply to this private message",
        },
    ]);

    assert.equal(await page.evaluate(() => {
        return $('#zhome .message_row').length;
    }), initial_msgs_qty + 2);

    await page.keyboard.press("KeyC");
    await page.waitForSelector('#stream-message', {visible: true});
    await check_compose_form_empty(page);

    await close_compose_box(page);
    await page.keyboard.press("KeyX");
    await page.waitForSelector("#private_message_recipient", {visible: true});
    await common.pm_recipient.expect(page, '');
    await close_compose_box(page);

    // Check that when you reply to a message it pre-populates the stream and topic fields
    const message_we_reply_to = (await page.$x("//p[text()='We reply to this message']")).slice(-1)[0];
    // we chose only the last element make sure we don't click on any duplicates.
    await message_we_reply_to.click();
    await common.check_form_contents(page,
                                     '#send_message_form',
                                     {
                                         stream_message_recipient_stream: "Verona",
                                         stream_message_recipient_topic: "Reply test",
                                         content: "",
                                     });
    await close_compose_box(page);

    // Check the same for a private message.
    const priv_msg_we_reply_to = (await page.$x("//p[text()='And reply to this private message']")).slice(-1)[0];
    await priv_msg_we_reply_to.click();
    await page.waitForSelector("#private_message_recipient", {visible: true});
    await common.pm_recipient.expect(page, "user8@zulip.testserver");

    // The last message(private) in the narrow is selected.
    // Now we go up and open compose box with r key
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyK");
    await page.keyboard.press("KeyR");
    await common.check_form_contents(page,
                                     '#send_message_form',
                                     {
                                         stream_message_recipient_stream: "Verona",
                                         stream_message_recipient_topic: "Reply test",
                                         content: "",
                                     });

    // Test opening and closing of compose box.
    await page.waitForSelector('#stream-message', {hidden: false});
    await close_compose_box(page);
    await page.waitForSelector('#stream-message', {hidden: true});

    await page.keyboard.press('KeyX');
    await page.waitForSelector('#private-message', {hidden: false});
    await close_compose_box(page);
    await page.waitForSelector('#private-message', {hidden: true});


    // Test focus after narrowing to PMs with a user and typing 'c'
    const you_and_cordelia_selector = '*[title="Narrow to your private messages with Cordelia Lear"]';
    // For some unknown reason page.click() isn't working here.
    await page.evaluate((selector) => document.querySelector(selector).click(),
                        you_and_cordelia_selector);
    const cordelia_user_id = 8;
    const pm_list_selector = `li[data-user-ids-string="${cordelia_user_id}"].expanded_private_message.active-sub-filter`;
    await page.waitForSelector(pm_list_selector, {visible: true});
    await close_compose_box(page);
    await page.keyboard.press('KeyC');
    await page.waitForSelector('#compose', {visible: true});
    await page.waitForFunction(() => {
        return document.activeElement === $('.compose_table #stream_message_recipient_stream')[0];
    });
    await close_compose_box(page);

    // Make sure multiple PM recipients display properly.
    const recipients = ['cordelia@zulip.com', 'othello@zulip.com'];
    await common.send_message(page, 'private', {
        recipient: recipients.join(', '),
        outside_view: true,
        content: 'A huddle to check spaces',
    });
    await close_compose_box(page);
    // Go back to all messages view and make sure all messages are loaded.
    await page.keyboard.press('Escape');
    await page.waitForSelector('#zhome .message_row');
    await (await page.$x("//p[text()='A huddle to check spaces']")).slice(-1)[0].click();
    await page.waitForSelector('#compose-textarea', {visible: true});
    await common.pm_recipient.expect(page, 'user12@zulip.testserver,user8@zulip.testserver');

    // Markdown preview related tests from here.
    await page.waitForSelector('#markdown_preview', {visible: true});
    await page.waitForSelector('#undo_markdown_preview', {visible: false});

    // verify if markdowm preview button works.
    await page.click('#markdown_preview');
    await page.waitForSelector('#markdown_preview', {visible: false});
    await page.waitForSelector('#undo_markdown_preview', {visible: true});

    // verify if write button works.
    await page.click("#undo_markdown_preview");
    await page.waitForSelector('#markdown_preview', {visible: true});
    await page.waitForSelector('#undo_markdown_preview', {visible: false});

    // check empty preview.
    await page.click('#markdown_preview');
    await page.waitForSelector('#undo_markdown_preview', {visible: true});
    let markdown_preview_element = await page.$("#preview_content");
    assert.equal(await page.evaluate(element => element.textContent, markdown_preview_element), "Nothing to preview");

    // Test actual markdown content.
    await page.click("#undo_markdown_preview");
    await page.waitForSelector('#markdown_preview', {visible: true});
    markdown_preview_element = await page.$("#preview_content");
    assert.equal(await page.evaluate(element => element.textContent, markdown_preview_element), "");
    await common.fill_form(page, 'form[action^="/json/messages"]', {
        content: '**Markdown Preview** >> Test for markdown preview',
    });
    await page.click('#markdown_preview');
    markdown_preview_element = await page.$("#preview_content");
    const expected_markdown_html = "<p><strong>Markdown Preview</strong> &gt;&gt; Test for markdown preview</p>";
    assert.equal(await page.evaluate(element => element.innerHTML, markdown_preview_element),
                 expected_markdown_html);
    await common.log_out(page);
}

common.run_test(compose_tests);
