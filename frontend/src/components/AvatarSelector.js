// src/components/AvatarSelector.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button, Modal, Form, Row, Col } from "react-bootstrap";
import "../styles/AvatarSelector.css"; // Import the CSS file

function AvatarSelector({ currentAvatar, onAvatarChange }) {
  const [show, setShow] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("avataaars");
  const [seed, setSeed] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Updated avatar styles for DiceBear API v7
  const avatarStyles = [
    { id: "avataaars", name: "People" },
    { id: "bottts", name: "Robots" },
    { id: "initials", name: "Initials" },
    { id: "micah", name: "Micah" },
    { id: "adventurer", name: "Adventurer" },
    { id: "funEmoji", name: "Emoji" }, // updated from fun-emoji to funEmoji
    { id: "pixelArt", name: "Pixel Art" }, // updated from pixel-art to pixelArt
  ];

  const handleClose = () => setShow(false);
  const handleShow = () => {
    // Set initial seed from username if not set
    if (!seed && currentAvatar) {
      // Try to extract seed from current avatar URL if it exists
      const match = currentAvatar.match(
        /avatars\.dicebear\.com\/(?:api|7\.x)\/([^/]+)\/([^.]+)/
      );
      if (match && match.length >= 3) {
        setSelectedStyle(match[1]);
        setSeed(match[2]);
      } else {
        // Default to username or random string
        setSeed(Math.random().toString(36).substring(2, 8));
      }
    }
    setShow(true);
  };

  const handleStyleChange = (e) => {
    setSelectedStyle(e.target.value);
  };

  const handleSeedChange = (e) => {
    setSeed(e.target.value);
  };

  useEffect(() => {
    if (selectedStyle && seed) {
      updatePreview(selectedStyle, seed);
    }
  }, [selectedStyle, seed]);

  const updatePreview = (style, seedValue) => {
    if (!seedValue) return;
    // Updated DiceBear API v7 URL format
    setPreviewAvatar(
      `https://api.dicebear.com/7.x/${style}/svg?seed=${seedValue}`
    );
  };

  const handleSaveAvatar = async () => {
    setIsLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/update-avatar/`,
        { profile_avatar: previewAvatar },
        { withCredentials: true }
      );
      onAvatarChange(previewAvatar);
      handleClose();
    } catch (error) {
      console.error("Error updating avatar:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate random avatars for the current style
  const generateRandomExamples = () => {
    const examples = [];
    for (let i = 0; i < 6; i++) {
      const randomSeed = Math.random().toString(36).substring(2, 8);
      examples.push({
        seed: randomSeed,
        // Updated DiceBear API v7 URL format
        url: `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${randomSeed}`,
      });
    }
    return examples;
  };

  const randomExamples = generateRandomExamples();

  const selectExample = (exampleSeed) => {
    setSeed(exampleSeed);
  };

  return (
    <>
      <Button
        variant="outline-primary"
        onClick={handleShow}
        className="change-avatar-btn"
      >
        <i className="bi bi-pencil"></i>
      </Button>

      <Modal show={show} onHide={handleClose} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Customize Your Avatar</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-4">
            <img
              src={previewAvatar}
              alt="Avatar Preview"
              width="150"
              height="150"
              className="rounded-circle avatar-preview"
            />
          </div>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Avatar Style</Form.Label>
              <Form.Select value={selectedStyle} onChange={handleStyleChange}>
                {avatarStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Customization Seed</Form.Label>
              <Form.Control
                type="text"
                value={seed}
                onChange={handleSeedChange}
                placeholder="Enter text to customize your avatar"
              />
              <Form.Text className="text-muted">
                Different text creates different avatars
              </Form.Text>
            </Form.Group>
          </Form>

          <h5 className="mt-4">Quick Options</h5>
          <p className="text-muted">Click an avatar to select it:</p>
          <Row className="avatar-examples">
            {randomExamples.map((example, index) => (
              <Col xs={4} sm={2} key={index} className="mb-3 text-center">
                <img
                  src={example.url}
                  alt={`Example ${index + 1}`}
                  width="60"
                  height="60"
                  className={`rounded-circle avatar-example ${
                    seed === example.seed ? "selected" : ""
                  }`}
                  onClick={() => selectExample(example.seed)}
                />
              </Col>
            ))}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAvatar}
            disabled={isLoading || !previewAvatar}
          >
            {isLoading ? "Saving..." : "Save Avatar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default AvatarSelector;
