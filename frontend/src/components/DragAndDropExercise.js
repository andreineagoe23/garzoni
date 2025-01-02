import React, { useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import styles from "../styles/DragAndDropExercise.module.css";

const DragAndDropExercise = ({ data }) => {
  const { items, targets } = data;

  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState("");

  const handleDrop = (target, item) => {
    setUserAnswers((prevAnswers) => ({
      ...prevAnswers,
      [target.id]: item.id,
    }));
  };

  const handleSubmit = () => {
    let correct = 0;
    targets.forEach((target) => {
      if (userAnswers[target.id] === target.id) {
        correct++;
      }
    });

    if (correct === targets.length) {
      setFeedback("All answers are correct! Great job!");
    } else {
      setFeedback(`${correct} out of ${targets.length} answers are correct.`);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.exerciseContainer}>
        <div className={styles.itemsContainer}>
          {items.map((item) => (
            <DraggableItem key={item.id} item={item} />
          ))}
        </div>
        <div className={styles.targetsContainer}>
          {targets.map((target) => (
            <DroppableTarget
              key={target.id}
              target={target}
              onDrop={handleDrop}
            />
          ))}
        </div>
        <button className={styles.submitButton} onClick={handleSubmit}>
          Submit Answers
        </button>
        {feedback && <p className={styles.feedback}>{feedback}</p>}
      </div>
    </DndProvider>
  );
};

const DraggableItem = ({ item }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "ITEM",
    item: { id: item.id, text: item.text },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`${styles.draggableItem} ${isDragging ? styles.dragging : ""}`}
    >
      {item.text}
    </div>
  );
};

const DroppableTarget = ({ target, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "ITEM",
    drop: (item) => onDrop(target, item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`${styles.droppableTarget} ${isOver ? styles.over : ""}`}
    >
      {target.text}
    </div>
  );
};

export default DragAndDropExercise;
