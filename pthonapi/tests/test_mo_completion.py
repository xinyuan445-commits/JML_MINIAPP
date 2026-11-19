import unittest

from routes.mo import (
    _append_record_text,
    _completion_is_partial,
    _first_step_material_calculation,
    _completion_photos,
    _complete_qty_from_body,
    _handover_good_qty,
    _initial_received_qty,
    _is_pure_a_completion,
    _photo_url_list,
    _quality_report_json,
    _quality_report_photos,
    _receive_qty_from_body,
    _validate_quality_report_photos,
    _validate_completion_photos,
    _rework_progress,
    _summarize_first_step_materials,
)


class CompletionProgressTests(unittest.TestCase):
    def test_partial_completion_detects_remaining_quantity(self):
        self.assertTrue(_completion_is_partial(0, 6, 10))
        self.assertTrue(_completion_is_partial(6, 3, 10))

    def test_reaching_or_exceeding_target_finishes_step(self):
        self.assertFalse(_completion_is_partial(6, 4, 10))
        self.assertFalse(_completion_is_partial(6, 5, 10))


class CompletionPhotoTests(unittest.TestCase):
    def test_photo_is_optional_when_everything_is_grade_a(self):
        self.assertTrue(_is_pure_a_completion(10, 0, 0, 0))

    def test_photo_is_required_for_other_grades(self):
        self.assertFalse(_is_pure_a_completion(9, 1, 0, 0))
        self.assertFalse(_is_pure_a_completion(9, 0, 1, 0))
        self.assertFalse(_is_pure_a_completion(9, 0, 0, 1))

    def test_quality_report_accepts_one_or_two_photos(self):
        self.assertEqual(
            _quality_report_photos({"quality_report_photo_urls": ["one.jpg"]}),
            ["one.jpg"],
        )
        self.assertEqual(
            _quality_report_photos({
                "quality_report_photo_urls": ["one.jpg", "two.jpg"]
            }),
            ["one.jpg", "two.jpg"],
        )

    def test_completion_photos_are_separate_and_allow_up_to_five(self):
        photos = [f"done-{index}.jpg" for index in range(5)]
        self.assertEqual(
            _completion_photos({"complete_photo_url": ",".join(photos)}),
            photos,
        )
        with self.assertRaisesRegex(ValueError, "最多上传5张"):
            _completion_photos({
                "complete_photo_url": photos + ["done-5.jpg"]
            })

    def test_quality_report_rejects_more_than_two_photos(self):
        with self.assertRaisesRegex(ValueError, "最多上传2张"):
            _quality_report_photos({
                "quality_report_photo_urls": ["one.jpg", "two.jpg", "three.jpg"]
            })

    def test_non_a_completion_requires_quality_report(self):
        with self.assertRaisesRegex(ValueError, "必须拍摄质量报告单照片"):
            _validate_quality_report_photos(9, 1, 0, 0, [])
        _validate_quality_report_photos(10, 0, 0, 0, [])
        _validate_quality_report_photos(9, 0, 1, 0, ["report.jpg"])

    def test_non_a_completion_also_requires_completion_photo(self):
        with self.assertRaisesRegex(ValueError, "必须拍摄完工照片"):
            _validate_completion_photos(9, 1, 0, 0, [])
        _validate_completion_photos(10, 0, 0, 0, [])
        _validate_completion_photos(9, 0, 0, 1, ["done.jpg"])

    def test_new_client_keeps_completion_and_quality_photos_separate(self):
        body = {
            "complete_photo_url": "done-1.jpg,done-2.jpg",
            "quality_report_photo_urls": ["report.jpg"],
        }
        self.assertEqual(
            _completion_photos(body), ["done-1.jpg", "done-2.jpg"]
        )
        self.assertEqual(_quality_report_photos(body), ["report.jpg"])

    def test_legacy_comma_photos_are_supported_and_json_is_written(self):
        self.assertEqual(_photo_url_list("one.jpg,two.jpg"), ["one.jpg", "two.jpg"])
        self.assertEqual(
            _quality_report_photos({
                "complete_photo_url": "one.jpg,two.jpg,three.jpg"
            }),
            ["one.jpg", "two.jpg"],
        )
        self.assertEqual(
            _quality_report_json(["one.jpg", "two.jpg"]),
            '["one.jpg", "two.jpg"]',
        )


class CompletionHistoryTests(unittest.TestCase):
    def test_photos_and_reasons_are_appended(self):
        self.assertEqual(_append_record_text("one.jpg", "two.jpg"), "one.jpg,two.jpg")
        self.assertEqual(_append_record_text("第一批", "第二批", "；"), "第一批；第二批")

    def test_empty_value_does_not_change_history(self):
        self.assertEqual(_append_record_text("one.jpg", ""), "one.jpg")
        self.assertIsNone(_append_record_text(None, None))


class ReworkProgressTests(unittest.TestCase):
    def test_partial_rework_uses_all_grades_as_completed_quantity(self):
        completed, remaining = _rework_progress({
            "qty_input": 20,
            "qty_a": 7,
            "qty_a1": 0,
            "qty_a2": 0,
            "qty_c": 1,
        })
        self.assertEqual(completed, 8)
        self.assertEqual(remaining, 12)

    def test_rework_remaining_never_becomes_negative(self):
        completed, remaining = _rework_progress({
            "qty_input": 10,
            "qty_a": 11,
            "qty_a1": 0,
            "qty_a2": 0,
            "qty_c": 0,
        })
        self.assertEqual(completed, 11)
        self.assertEqual(remaining, 0)


class HandoverQuantityTests(unittest.TestCase):
    def test_first_receipt_accepts_a_a1_a2_split(self):
        self.assertEqual(
            _receive_qty_from_body({"qty_a": 6, "qty_a1": 3, "qty_a2": 1}),
            (6, 3, 1, 10),
        )

    def test_c_grade_is_not_included_in_handover_quantity(self):
        *_, total, good_total = _complete_qty_from_body({
            "qty_a": 9, "qty_a1": 0, "qty_a2": 0, "qty_c": 1
        })
        self.assertEqual(total, 10)
        self.assertEqual(good_total, 9)

    def test_handover_uses_grade_a_a1_a2_total(self):
        self.assertEqual(_handover_good_qty({
            "qty_out": 10,
            "qty_out_a": 8,
            "qty_out_a1": 1,
            "qty_out_a2": 0,
        }), 9)

    def test_initial_receipt_uses_quantity_before_first_makeup(self):
        handover = {"qty_in": 20}
        self.assertEqual(_initial_received_qty(handover, [{"qty_before": 10}]), 10)
        self.assertEqual(_initial_received_qty(handover, []), 20)


class FirstStepMaterialReceiptTests(unittest.TestCase):
    def test_sums_issued_quantity_across_controlled_material_lines(self):
        lines, total = _summarize_first_step_materials([
            {"sub_code": "1001", "qty_plan": 10, "qty_issued": 0},
            {"sub_code": "2001", "qty_plan": 10, "qty_issued": 6},
            {"sub_code": "3101", "qty_plan": 10, "qty_issued": 4},
            {"sub_code": "3501", "qty_plan": 20, "qty_issued": 20},
        ])
        self.assertEqual(len(lines), 3)
        self.assertEqual(total, 10)

    def test_allows_partial_issue_but_zero_issue_sums_to_zero(self):
        _, partial_total = _summarize_first_step_materials([
            {"sub_code": "1001", "qty_plan": 10, "qty_issued": 3},
            {"sub_code": "2001", "qty_plan": 10, "qty_issued": 0},
        ])
        _, empty_total = _summarize_first_step_materials([
            {"sub_code": "1001", "qty_plan": 10, "qty_issued": 0},
        ])
        self.assertEqual(partial_total, 3)
        self.assertEqual(empty_total, 0)

    def test_falls_back_to_all_material_ratios_when_no_controlled_lines(self):
        lines, total = _summarize_first_step_materials([
            {"sub_code": "4402-A", "qty_plan": 100, "qty_issued": 100},
            {"sub_code": "4402-B", "qty_plan": 50, "qty_issued": 40},
        ], plan_qty=300)
        self.assertEqual(len(lines), 2)
        self.assertEqual(total, 240)

    def test_fallback_keeps_the_bottleneck_material_formula(self):
        _, total, calculation = _first_step_material_calculation([
            {"sub_code": "4402-A", "qty_plan": 100, "qty_issued": 100},
            {"sub_code": "4402-B", "qty_plan": 50, "qty_issued": 40},
        ], plan_qty=300)
        self.assertEqual(total, 240)
        self.assertEqual(calculation, {
            "mode": "bom_ratio",
            "material_count": 2,
            "bottleneck_inv_code": "4402-B",
            "bottleneck_required_qty": 50,
            "bottleneck_issued_qty": 40,
            "bottleneck_ratio": 0.8,
        })

    def test_fallback_does_not_allow_more_than_plan_quantity(self):
        _, total = _summarize_first_step_materials([
            {"sub_code": "4402-A", "qty_plan": 100, "qty_issued": 120},
        ], plan_qty=300)
        self.assertEqual(total, 300)


if __name__ == "__main__":
    unittest.main()
