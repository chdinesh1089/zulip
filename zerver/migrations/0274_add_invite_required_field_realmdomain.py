# Generated by Django 2.2.10 on 2020-04-16 18:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0273_rename_invite_required_to_default_invite_required'),
    ]

    operations = [
        migrations.AddField(
            model_name='realmdomain',
            name='invite_required',
            field=models.BooleanField(default=True),
        ),
    ]
