from services.settings_service import _truthy, is_masked, mask


def test_truthy():
    assert _truthy("true") and _truthy("True") and _truthy("1") and _truthy("yes")
    assert not _truthy("false") and not _truthy("") and not _truthy(None)


def test_mask_long_secret_keeps_edges():
    assert mask("sk-ant-abc123xyz789") == "sk-a…z789"


def test_mask_short_secret_fully_hidden():
    assert mask("short") == "***"
    assert mask(None) is None
    assert mask("") is None


def test_is_masked_detects_masked_values():
    assert is_masked(mask("sk-ant-abc123xyz789"))
    assert is_masked("***")
    assert is_masked(None)
    assert not is_masked("sk-ant-a-real-new-key")


def test_roundtrip_never_writes_masked_value_back():
    original = "hvy_0123456789abcdef"
    shown = mask(original)
    # Simulates the settings form re-submitting the displayed placeholder
    assert is_masked(shown) is True
