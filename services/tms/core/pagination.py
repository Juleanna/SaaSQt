from rest_framework.pagination import CursorPagination
import os


class DefaultCursorPagination(CursorPagination):
    page_size = int(os.getenv('PAGE_SIZE', '25'))
    ordering = os.getenv('CURSOR_ORDERING', '-id')


class CreatedAtCursorPagination(CursorPagination):
    page_size = int(os.getenv('PAGE_SIZE', '25'))
    ordering = '-created_at'
