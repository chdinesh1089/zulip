# Generated by Django 2.2.10 on 2020-04-14 12:18

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0275_remove_userprofile_last_pointer_updater'),
    ]

    operations = [
        migrations.RenameField(
            model_name='realm',
            old_name='invite_required',
            new_name='default_invite_required',
        ),
    ]
