# support/admin.py
from django.contrib import admin
from support.models import FAQ, ContactMessage


admin.site.register(FAQ)
admin.site.register(ContactMessage)

