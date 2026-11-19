import unittest

from services.mo_workorder_context import upsert_workorder_context, values_from_header


class FakeCursor:
    def __init__(self):
        self.executed = None
        self.closed = False

    def execute(self, sql, values):
        self.executed = (sql, values)

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self):
        self.cursor_value = FakeCursor()
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self.cursor_value

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class WorkorderContextTests(unittest.TestCase):
    def test_maps_customer_trace_fields_without_using_sales_line_as_a_key(self):
        values = values_from_header({
            "MoCode_a": "SCDD26103063",
            "SortSeq_b": 1,
            "InvCode_b": "PRODUCT-1",
            "cInvName": "测试产品",
            "cInvStd": "1220*2745",
            "Qty_b": 20,
            "SOCode008": "XSDD008",
            "SORow008": 8,
            "SourceAccount": "001",
            "SourceSOCode": "XSDD261094843",
            "CustomerCode": "0728",
            "CustomerName": "测试客户",
        })

        self.assertEqual(values[0:2], ("SCDD26103063", 1))
        self.assertEqual(values[6:10], ("XSDD008", 8, "001", "XSDD261094843"))
        self.assertEqual(values[11:13], ("0728", "测试客户"))

    def test_upsert_uses_the_supplied_transaction(self):
        connection = FakeConnection()
        upsert_workorder_context({
            "MoCode_a": "SCDD1",
            "SortSeq_b": 2,
            "SourceAccount": "002",
        }, connection=connection)

        self.assertIsNotNone(connection.cursor_value.executed)
        self.assertFalse(connection.committed)
        self.assertFalse(connection.rolled_back)
        self.assertTrue(connection.cursor_value.closed)

    def test_rejects_incomplete_workorder_identity(self):
        with self.assertRaises(ValueError):
            values_from_header({"MoCode_a": "SCDD1"})


if __name__ == "__main__":
    unittest.main()
