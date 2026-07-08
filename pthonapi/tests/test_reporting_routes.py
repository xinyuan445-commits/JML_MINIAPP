import unittest

from scripts.apply_reporting_routes_v2 import REPORTING_ROUTES


class ReportingRouteTests(unittest.TestCase):
    def test_expected_products_are_covered(self):
        self.assertEqual(
            set(REPORTING_ROUTES),
            {"04", "05", "06", "07", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"},
        )

    def test_routes_do_not_repeat_processes(self):
        for product_code, steps in REPORTING_ROUTES.items():
            with self.subTest(product_code=product_code):
                self.assertEqual(len(steps), len(set(steps)))

    def test_cost_only_nodes_are_not_reporting_steps(self):
        removed = {"三胺压贴", "泰兴工厂压贴"}
        for product_code, steps in REPORTING_ROUTES.items():
            with self.subTest(product_code=product_code):
                self.assertTrue(removed.isdisjoint(steps))

    def test_hpl_routes_keep_backing_board_bonding(self):
        for product_code in ("07", "10", "19"):
            self.assertEqual(REPORTING_ROUTES[product_code][0], "HPL三胺基材粘贴垫板")
        self.assertEqual(REPORTING_ROUTES["15"][0], "HPL素板粘贴垫板")


if __name__ == "__main__":
    unittest.main()
