// Low-level ops for the CV component tree — cloned from helpers/components.js
// but pointed at cv_components / cv_components_relationships and owner-aware.
// The per-user owner_id is persisted on create; NULL means a global/shared node.
const { pool } = require('../../db');

async function fetchCvChildren(parent) {
  const query = `
    SELECT c.*
    FROM cv_components_relationships cr
    JOIN cv_components c ON cr.child_id = c.id
    WHERE cr.parent_id = $1::uuid
    ORDER BY cr.position ASC
  `;
  try {
    const res = await pool.query(query, [parent.id]);
    return res.rows;
  } catch (error) {
    console.error(error);
    throw new Error('Error fetching cv children');
  }
}

const postCvComponent = async (name, type, data, options, owner_id, children) => {
  const query = `
    INSERT INTO cv_components (name, type, data, options, owner_id)
    VALUES ($1::text, $2::text, $3::json, $4::json, $5::uuid) RETURNING *
  `;
  try {
    const res = await pool.query(query, [name, type, data, options, owner_id ?? null]);
    if (children) {
      for (let child of children) {
        const childRes = await postCvComponent(child.name, child.type, child.data, child.options, owner_id, child.children);
        await relateCvComponents(res.rows[0].id, childRes.id);
      }
    }
    return res.rows[0];
  } catch (error) {
    console.error(error);
    throw new Error('Error creating cv component');
  }
};

const updateCvComponent = async (id, name, type, data, options) => {
  const query = 'UPDATE cv_components SET name = $1::text, type = $2::text, data = $3::json, options = $4::json WHERE id = $5::uuid RETURNING *';
  try {
    const res = await pool.query(query, [name, type, data, options, id]);
    return res.rows[0];
  } catch (error) {
    console.error(error);
    throw new Error('Error updating cv component');
  }
};

const deleteCvComponent = async (id) => {
  try {
    await pool.query('DELETE FROM cv_components WHERE id = $1::uuid', [id]);
    return true;
  } catch (error) {
    console.error(error);
    throw new Error('Error deleting cv component');
  }
};

const deleteCvRelation = async (parent_id, child_id) => {
  try {
    await pool.query('DELETE FROM cv_components_relationships WHERE parent_id = $1::uuid AND child_id = $2::uuid', [parent_id, child_id]);
    return true;
  } catch (error) {
    console.error(error);
    throw new Error('Error deleting cv relation');
  }
};

const relateCvComponents = async (parentId, childId) => {
  const query = `
    INSERT INTO cv_components_relationships (parent_id, child_id, position)
    VALUES ($1::uuid, $2::uuid,
      (SELECT COALESCE(MAX(position) + 1, 0) FROM cv_components_relationships WHERE parent_id = $1::uuid))
    ON CONFLICT (parent_id, child_id) DO NOTHING
  `;
  try {
    await pool.query(query, [parentId, childId]);
    return true;
  } catch (error) {
    console.error(error);
    throw new Error('Error relating cv components');
  }
};

module.exports = {
  fetchCvChildren, postCvComponent, updateCvComponent,
  deleteCvComponent, deleteCvRelation, relateCvComponents,
};
