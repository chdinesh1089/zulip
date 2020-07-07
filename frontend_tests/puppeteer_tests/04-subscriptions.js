const common = require('../puppeteer_lib/common');
const assert = require("assert").strict;

async function user_checkbox(page, name) {
    const user_id = await common.get_user_id_from_name(page, name);
    return `#user-checkboxes [data-user-id="${user_id}"]`;
}

async function user_span(page, name) {
    return await user_checkbox(page, name) + ' input ~ span';
}

async function stream_checkbox(page, stream_name) {
    const stream_id = await common.get_stream_id(page, stream_name);
    return `#stream-checkboxes [data-stream-id="${stream_id}"]`;
}

async function stream_span(page, stream_name) {
    return await stream_checkbox(page, stream_name) + ' input ~ span';
}

async function wait_for_checked(page, user_name, is_checked) {
    const selector = await user_checkbox(page, user_name);
    await page.waitForFunction((selector, is_checked) => $(selector).find('input')[0].checked === is_checked,
                               {}, selector, is_checked);
}

async function stream_name_error(page) {
    await page.waitForSelector('#stream_name_error', {visible: true});
    return await common.get_text_from_selector(page, '#stream_name_error');
}
async function subscriptions_tests(page) {
    await common.log_in(page);

    const all_streams_selector = 'a[href="#streams/all"]';
    await page.waitForSelector(all_streams_selector, {visible: true});
    await page.click(all_streams_selector);

    await page.waitForSelector('#subscription_overlay.new-style', {visible: true});
    assert(page.url().includes('#streams/all'));

    // Test subscribe and unsubscribe button for #Verona

    const verona_sub_unsub_checked_selector = "[data-stream-name='Verona'] .sub_unsub_button.checked";
    const verona_sub_unsub_unchecked_selector = "[data-stream-name='Verona'] .sub_unsub_button:not(.checked)";

    // assert it's already checked.
    await page.waitForSelector(verona_sub_unsub_checked_selector, {visible: true});
    // get subscribe/unsubscribe button emlement.
    const sub_unsub_element = await page.$("[data-stream-name='Verona'] .sub_unsub_button");
    await sub_unsub_element.click();  // Unsubscribe.
    await page.waitForSelector(verona_sub_unsub_unchecked_selector); // Unsubscribed.
    await sub_unsub_element.click({delay: 10});  // Subscribe again now.
    await page.waitForSelector(verona_sub_unsub_checked_selector, {visible: true}); // Subscribed.

    const cordelia_checkbox = await user_checkbox(page, 'cordelia');
    const othello_checkbox = await user_checkbox(page, 'othello');
    const scotland_checkbox = await stream_checkbox(page, 'Scotland');
    const rome_checkbox = await stream_checkbox(page, 'Rome');

    // Test creation of stream and related UI.
    await page.click('#add_new_subscription .create_stream_button');
    await page.waitForSelector(cordelia_checkbox, {visible: true});
    await page.waitForSelector(othello_checkbox, {visible: true});

    await page.click('#copy-from-stream-expand-collapse .control-label');
    await page.waitForSelector(scotland_checkbox, {visible: true});
    await page.waitForSelector(rome_checkbox, {visible: true});

    // Test user filter search UI.
    await page.waitForSelector('form#stream_creation_form', {visible: true});
    await common.fill_form(page, 'form#stream_creation_form', {user_list_filter: 'ot'});
    await page.waitForSelector('#user-checkboxes', {visible: true});
    await page.waitForSelector(cordelia_checkbox, {hidden: true});
    await page.waitForSelector(othello_checkbox, {visible: true});
    // Filter shouln't affect streams.
    await page.waitForSelector(scotland_checkbox, {visible: true});
    await page.waitForSelector(rome_checkbox, {visible: true});

    // "Check all" should effect only visible users.
    await page.click('.subs_set_all_users');
    await wait_for_checked(page, 'cordelia', false);
    await wait_for_checked(page, 'othello', true);

    // Test "Uncheck all".
    await page.click('.subs_unset_all_users');
    await wait_for_checked(page, 'othello', false);

    // Clear input in filter search box by typing backspace twice.
    await page.click('.add-user-list-filter');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');


    // Check if the hidden ones are visble again on clearing search field.
    await page.waitForSelector(cordelia_checkbox, {visible: true});
    await page.waitForSelector(othello_checkbox, {visible: true});

    // Create stream.
    await page.waitForXPath('//*[text()="Create stream"]', {visible: true});
    await common.fill_form(page, 'form#stream_creation_form', {
        stream_name: 'Puppeteer', stream_description: "Everything puppeteer",
    });
    await page.click(await stream_span(page, 'Scotland'));  //  Subscribes all users from Scotland
    await page.click(await user_span(page, 'cordelia'));  // Add cordelia.
    await wait_for_checked(page, 'cordelia', true);
    await page.click(await user_span(page, 'othello'));  // Add othello who was selected from Scotland.
    await wait_for_checked(page, 'othello', false);
    await page.click('form#stream_creation_form button.button.sea-green');
    await page.waitForFunction(() => $('.stream-name').is(':contains("Puppeteer")'));
    const stream_name = await common.get_text_from_selector(page, '.stream-header .stream-name .stream-name-editable');
    const stream_description = await common.get_text_from_selector(page, '.stream-description-editable ');
    const subscriber_count_selector = "[data-stream-name='Puppeteer'] .subscriber-count";
    assert.strictEqual(stream_name, 'Puppeteer');
    assert.strictEqual(stream_description, 'Everything puppeteer');
    await page.waitForFunction((subscriber_count_selector) => $(subscriber_count_selector).text().trim() === '4',
                               {}, subscriber_count_selector);

    // Streams with empty name cannot be created.
    await page.click('#add_new_subscription .create_stream_button');
    await page.waitForSelector('form#stream_creation_form', {visible: true});
    await common.fill_form(page, 'form#stream_creation_form', {stream_name: '  '});
    await page.click('form#stream_creation_form button.button.sea-green');
    assert.strictEqual(await stream_name_error(page), 'A stream needs to have a name');

    // Streams with same names cannot be created.
    await common.fill_form(page, 'form#stream_creation_form', {stream_name: 'Puppeteer'});
    await page.click('form#stream_creation_form button.button.sea-green');
    assert.strictEqual(await stream_name_error(page), 'A stream with this name already exists');

    const cancel_button_selector = 'form#stream_creation_form button.button.white';
    await page.click(cancel_button_selector);

    // Test stream search feature.
    assert.strictEqual(await common.get_text_from_selector(page, '#search_stream_name'), '');
    const hidden_streams_selector = '.stream-row.notdisplayed .stream-name';
    assert.strictEqual(await common.get_text_from_selector(page, '.stream-row[data-stream-name="Verona"] .stream-name'), 'Verona');
    assert(!(await common.get_text_from_selector(page, hidden_streams_selector)).includes("Verona"),
           "#Verona is hidden");

    await page.type('#stream_filter input[type="text"]', 'Puppeteer');
    assert.strictEqual(await common.get_text_from_selector(page, '.stream-row:not(.notdisplayed) .stream-name'), 'Puppeteer');
    assert((await common.get_text_from_selector(page, hidden_streams_selector)).includes('Verona'), '#Verona is not hidden');
    assert(!(await common.get_text_from_selector(page, hidden_streams_selector)).includes('Puppeteer'),
           'Puppeteer is hidden after searching.');
}

common.run_test(subscriptions_tests);
