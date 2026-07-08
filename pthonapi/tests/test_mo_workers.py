import unittest

from routes.mo import _makeup_exceeds_plan, _temp_worker_count


class TempWorkerCountTests(unittest.TestCase):
    def test_missing_count_defaults_to_zero(self):
        self.assertEqual(_temp_worker_count({}), 0)

    def test_integer_count_is_accepted(self):
        self.assertEqual(_temp_worker_count({"temp_worker_count": 3}), 3)

    def test_non_integer_count_is_rejected(self):
        with self.assertRaises(ValueError):
            _temp_worker_count({"temp_worker_count": 1.5})

    def test_out_of_range_count_is_rejected(self):
        for value in (-1, 51):
            with self.assertRaises(ValueError):
                _temp_worker_count({"temp_worker_count": value})


class MakeupPlanTests(unittest.TestCase):
    def test_equal_to_plan_does_not_require_reason(self):
        self.assertFalse(_makeup_exceeds_plan(8, 2, 10))

    def test_over_plan_requires_reason(self):
        self.assertTrue(_makeup_exceeds_plan(8, 3, 10))

    def test_missing_plan_keeps_backward_compatibility(self):
        self.assertFalse(_makeup_exceeds_plan(8, 3, None))


if __name__ == "__main__":
    unittest.main()
